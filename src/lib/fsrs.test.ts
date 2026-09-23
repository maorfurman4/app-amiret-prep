import { describe, it, expect } from 'vitest';
import {
  Again, Hard, Good, Easy, FSRS_WEIGHTS, MS_PER_DAY, MIN_INTERVAL_DAYS, MAX_INTERVAL_DAYS,
  retrievability, intervalForRetention, initialState, reviewCard, desiredRetention,
  capDueToExam, scheduleDue, examInstant, gradeResponse, type CardState,
} from './fsrs';

const T0 = new Date('2026-10-01T12:00:00.000Z');
const days = (n: number, from: Date = T0) => new Date(from.getTime() + n * MS_PER_DAY);
const daysBetween = (a: Date, b: Date) => (b.getTime() - a.getTime()) / MS_PER_DAY;

describe('forgetting curve', () => {
  it('retrievability is 90% exactly one stability-length after review', () => {
    for (const s of [0.5, 3, 40]) expect(retrievability(s, s)).toBeCloseTo(0.9, 10);
  });
  it('starts at 1 and decays monotonically', () => {
    expect(retrievability(0, 5)).toBe(1);
    expect(retrievability(1, 5)).toBeGreaterThan(retrievability(10, 5));
  });
  it('the interval for 90% retention equals stability; higher targets are shorter', () => {
    expect(intervalForRetention(12, 0.9)).toBeCloseTo(12, 10);
    expect(intervalForRetention(12, 0.95)).toBeLessThan(12);
  });
});

describe('FSRS-4.5 state transitions', () => {
  it('first exposure uses the published initial stabilities per grade', () => {
    expect(initialState(Again, T0).stability).toBe(FSRS_WEIGHTS[0]);
    expect(initialState(Easy, T0).stability).toBe(FSRS_WEIGHTS[3]);
    expect(initialState(Again, T0)).toMatchObject({ reps: 1, lapses: 1 });
    expect(initialState(Again, T0).difficulty).toBeGreaterThan(initialState(Easy, T0).difficulty);
  });

  const card: CardState = { stability: 4, difficulty: 5, reps: 3, lapses: 1, lastReviewAt: T0 };

  it('is time-aware: a correct answer seconds later barely moves stability', () => {
    const immediate = reviewCard(card, Good, new Date(T0.getTime() + 30_000));
    expect(immediate.stability / card.stability).toBeLessThan(1.01);
  });

  it('a successful review after real forgetting grows stability a lot', () => {
    const later = reviewCard(card, Good, days(4));
    expect(later.stability / card.stability).toBeGreaterThan(2);
    // …and more elapsed time (lower R at review) means a bigger gain.
    expect(reviewCard(card, Good, days(8)).stability).toBeGreaterThan(later.stability);
  });

  it('orders recall grades Easy > Good > Hard, and a lapse shrinks stability', () => {
    const at = days(4);
    const [h, g, e] = [Hard, Good, Easy].map(grade => reviewCard(card, grade, at).stability);
    expect(e).toBeGreaterThan(g);
    expect(g).toBeGreaterThan(h);
    const lapse = reviewCard(card, Again, at);
    expect(lapse.stability).toBeLessThan(card.stability);
    expect(lapse.lapses).toBe(card.lapses + 1);
  });

  it('difficulty rises on failure, falls on Easy, and stays within [1, 10]', () => {
    expect(reviewCard(card, Again, days(4)).difficulty).toBeGreaterThan(card.difficulty);
    expect(reviewCard(card, Easy, days(4)).difficulty).toBeLessThan(card.difficulty);
    let hard = card; let easy = card;
    for (let i = 1; i <= 50; i++) {
      hard = reviewCard(hard, Again, days(i));
      easy = reviewCard(easy, Easy, days(i * 3));
    }
    expect(hard.difficulty).toBeLessThanOrEqual(10);
    expect(easy.difficulty).toBeGreaterThanOrEqual(1);
  });
});

describe('implicit grading from correctness + latency', () => {
  const sc = (latencyMs: number | null, extra: object = {}) =>
    gradeResponse({ correct: true, latencyMs, type: 'sentence_completion', ...extra });

  it.each([
    ['wrong is always Again', gradeResponse({ correct: false, latencyMs: 10_000, type: 'restatement' }), Again],
    ['implausibly fast (guess) is Hard', sc(2_000), Hard],
    ['within a third of the 60s budget is Easy', sc(15_000), Easy],
    ['within budget is Good', sc(45_000), Good],
    ['over budget is Hard', sc(95_000), Hard],
    ['no latency is Good', sc(null), Good],
  ])('%s', (_label, grade, expected) => expect(grade).toBe(expected));

  it('uses each type’s own budget', () => {
    // 50s: over a third of SC's 60s (Good) but under a third of RC's 180s (Easy).
    expect(gradeResponse({ correct: true, latencyMs: 50_000, type: 'sentence_completion' })).toBe(Good);
    expect(gradeResponse({ correct: true, latencyMs: 50_000, type: 'reading_comprehension' })).toBe(Easy);
  });

  it('self-reported confidence can only lower the grade', () => {
    expect(sc(15_000, { confidence: 1 })).toBe(Hard);
    expect(sc(15_000, { confidence: 2 })).toBe(Good);
    expect(sc(95_000, { confidence: 3 })).toBe(Hard);
  });
});

describe('exam-date awareness', () => {
  const exam = examInstant('2026-11-01')!;

  it('parses a calendar date to a morning sitting and rejects junk', () => {
    expect(exam.toISOString()).toBe('2026-11-01T06:00:00.000Z');
    expect(examInstant('01/11/2026')).toBeNull();
    expect(examInstant(null)).toBeNull();
  });

  it('ramps target retention from 90% to 95% over the final two weeks', () => {
    expect(desiredRetention(days(-30, exam), exam)).toBe(0.9);
    expect(desiredRetention(days(-7, exam), exam)).toBeCloseTo(0.925, 10);
    expect(desiredRetention(days(-0.01, exam), exam)).toBeCloseTo(0.95, 3);
    expect(desiredRetention(days(1, exam), exam)).toBe(0.9); // after the exam
    expect(desiredRetention(T0, null)).toBe(0.9);
  });

  it('leaves due dates before the peak window alone', () => {
    const now = days(-30, exam);
    const due = days(5, now);
    expect(capDueToExam(due, now, exam)).toEqual(due);
  });

  it('pulls an overshooting due date to 2 days before the exam', () => {
    const now = days(-30, exam);
    expect(capDueToExam(days(60, now), now, exam)).toEqual(days(-2, exam));
  });

  it('inside the window, schedules as late as allowed (1 day before) but not in the past', () => {
    const now = days(-1.5, exam);
    const capped = capDueToExam(days(20, now), now, exam);
    expect(capped.getTime()).toBeGreaterThan(now.getTime());
    expect(capped.getTime()).toBeLessThanOrEqual(days(-1, exam).getTime());
  });

  it('keeps the final 24 hours review-free: holds cards until the exam, never past it', () => {
    const now = days(-0.5, exam);
    expect(capDueToExam(days(20, now), now, exam)).toEqual(exam);
    expect(capDueToExam(days(0.25, now), now, exam)).toEqual(exam); // even a short interval
  });

  it('stops capping once the exam has passed', () => {
    const now = days(2, exam);
    const due = days(30, now);
    expect(capDueToExam(due, now, exam)).toEqual(due);
  });

  it('keeps intervals within bounds without an exam', () => {
    expect(daysBetween(T0, scheduleDue(0.001, T0, null))).toBeCloseTo(MIN_INTERVAL_DAYS, 10);
    expect(daysBetween(T0, scheduleDue(10_000, T0, null))).toBeCloseTo(MAX_INTERVAL_DAYS, 10);
  });

  it('compresses: the same card gets a shorter interval as the exam approaches', () => {
    const far = daysBetween(days(-40, exam), scheduleDue(3, days(-40, exam), exam));
    const near = daysBetween(days(-8, exam), scheduleDue(3, days(-8, exam), exam));
    expect(near).toBeLessThan(far);
  });

  it('simulation: a student reviewing whenever due always lands a final review 1–3 days before the exam', () => {
    for (const startDaysOut of [60, 30, 21, 12, 7]) {
      for (const grade of [Hard, Good, Easy]) {
        let now = days(-startDaysOut, exam);
        let card = initialState(Again, now);
        let due = scheduleDue(card.stability, now, exam);
        let lastReview = now;
        while (due.getTime() < exam.getTime()) {
          now = due;
          card = reviewCard(card, grade, now);
          lastReview = now;
          due = scheduleDue(card.stability, now, exam);
        }
        const lead = daysBetween(lastReview, exam);
        expect(lead, `start ${startDaysOut}d out, grade ${grade}`).toBeGreaterThanOrEqual(1 - 1e-9);
        expect(lead, `start ${startDaysOut}d out, grade ${grade}`).toBeLessThanOrEqual(3 + 1e-9);
      }
    }
  });
});
