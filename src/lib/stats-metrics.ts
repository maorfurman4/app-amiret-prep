import { SECTION_CONFIGS, classifyScore, isCorrectAnswer, isExperimentalSection, type Question, type ScoreClassification, type SectionResult } from '@/types/exam';
import { EXEMPTION_SCORE } from '@/lib/calibration';
import { POOL_WINDOW } from '@/lib/exemption';
import { isLowEffortExam } from '@/lib/exam-effort';
import { aggregateAccuracyByType, computeWeakestType, type AccuracyByType, type TypeAccuracy, type WeaknessResult } from '@/lib/weakness';
import { heCount, agree } from '@/lib/hebrew-count';

/**
 * Every number on /stats, computed once. The page and its cards only
 * render what this returns — none of them aggregate on their own — so one
 * metric can't show two values in two places again (the old page had two
 * averages, two "points to 134" and two per-type tallies over different,
 * unlabelled windows).
 *
 * Windows, each named wherever its numbers are shown:
 *  - headline score: the latest exam that measured the student
 *  - readiness scores: the last POOL_WINDOW of those (src/lib/exemption.ts)
 *  - accuracy, difficulty, pace: the last RECENT_WINDOW exams, or all-time
 *  - exam count, best score, trend: all exams
 * Accuracy only counts scored questions (the experimental section never
 * counts toward the score).
 *
 * Only actual exam scores are shown — no pooled "estimated level" or
 * exemption probability: with uncalibrated items and no official scores
 * to anchor the scale, those claimed more than the data supports.
 *
 * The headline score and readiness rest only on exams that measured the
 * student: one clicked through at random (src/lib/exam-effort.ts) still
 * counts as an exam and keeps its score, but says nothing about ability.
 */

export const RECENT_WINDOW = 10;

export interface StatsRow {
  score: number;
  completed_at: string;
  section_results: unknown;
}

export type DifficultyBucket = 'easy' | 'medium' | 'hard';
export const DIFFICULTY_BUCKETS: DifficultyBucket[] = ['easy', 'medium', 'hard'];

export interface AccuracyWindow {
  /** How many exams this window covers. */
  exams: number;
  /** True when it covers every exam (so "last 10" and "all" are the same). */
  isAllTime: boolean;
  byType: AccuracyByType;
  /** Per question, by that question's own level: 1–2 easy, 3 medium, 4–5 hard. */
  byDifficulty: Record<DifficultyBucket, TypeAccuracy>;
}

export interface MeasuredScore {
  /** The score of the latest exam that measured the student. */
  score: number;
  /** False when a later exam was clicked through at random and left out. */
  isLatestExam: boolean;
  /** Points from that score to 134; 0 once it's reached. */
  pointsToTarget: number;
}

export interface ReadinessReason { ok: boolean; text: string; href?: string }

export interface Readiness {
  verdict: 'ready' | 'almost' | 'not_yet';
  reasons: ReadinessReason[];
}

export interface StatsMetrics {
  examCount: number;
  bestScore: number;
  lastScore: number;
  bestClassification: ScoreClassification;
  /** Null when no exam measured the student. */
  measured: MeasuredScore | null;
  recent: AccuracyWindow;
  allTime: AccuracyWindow;
  /** Weakest type over the recent window + the practice level — the same pick as today's session. */
  weakest: WeaknessResult | null;
  readiness: Readiness;
  /** Exams left out of the headline score, trend and readiness as clicked through at random. */
  excludedLowEffort: number;
}

const PACE_CAPS: Record<string, number> = { sentence_completion: 90, restatement: 150, reading_comprehension: 180 };

const TYPE_LABELS: Record<string, string> = {
  sentence_completion: 'השלמת משפטים',
  restatement: 'ניסוח מחדש',
  reading_comprehension: 'הבנת הנקרא',
  esra: 'אנגלית ESRA',
};
export const typeLabel = (t: string) => TYPE_LABELS[t] ?? t;

/**
 * Isolates a number run ("50–56", "4–5") as left-to-right inside Hebrew
 * text. Without it the en dash is a neutral that the RTL paragraph
 * reorders, printing "56–50" (the page's copy is plain strings, not JSX,
 * so <bdi> isn't available here).
 */
export const ltr = (s: string | number) => `\u2066${s}\u2069`;

const bucketOf = (level: number): DifficultyBucket => (level <= 2 ? 'easy' : level === 3 ? 'medium' : 'hard');

const scoredSections = (rows: { section_results: unknown }[]) =>
  rows.flatMap(r => ((r.section_results ?? []) as SectionResult[]).filter(sr => !isExperimentalSection(sr.sectionIndex)));

/**
 * Accuracy by the level of each question itself. A section's items are
 * picked by information, not by level, so one section can mix levels —
 * the old breakdown filed the whole section under its first question's
 * level. A section stored without per-question answers falls back to that
 * section-level tally.
 */
export function aggregateAccuracyByDifficulty(rows: { section_results: unknown }[]): Record<DifficultyBucket, TypeAccuracy> {
  const out: Record<DifficultyBucket, TypeAccuracy> = {
    easy: { correct: 0, total: 0 },
    medium: { correct: 0, total: 0 },
    hard: { correct: 0, total: 0 },
  };
  for (const sr of scoredSections(rows)) {
    const questions = (sr.questions ?? []) as Question[];
    if (Array.isArray(sr.answers) && sr.answers.length === questions.length) {
      questions.forEach((q, i) => {
        if (!q?.difficulty_level) return;
        const b = out[bucketOf(q.difficulty_level)];
        b.total += 1;
        if (isCorrectAnswer(q, sr.answers[i])) b.correct += 1;
      });
    } else {
      const level = questions[0]?.difficulty_level;
      if (!level) continue;
      out[bucketOf(level)].correct += sr.correctCount ?? 0;
      out[bucketOf(level)].total += sr.totalCount ?? 0;
    }
  }
  return out;
}

function accuracyWindow(rows: StatsRow[], all: number): AccuracyWindow {
  return {
    exams: rows.length,
    isAllTime: rows.length === all,
    byType: aggregateAccuracyByType(rows),
    byDifficulty: aggregateAccuracyByDifficulty(rows),
  };
}

/** `measured` = the exams that measured the student, oldest first; `all` = every exam. */
export function computeMeasuredScore(measured: StatsRow[], all: StatsRow[]): MeasuredScore | null {
  const latest = measured[measured.length - 1];
  if (!latest) return null;
  return {
    score: latest.score,
    isLatestExam: latest === all[all.length - 1],
    pointsToTarget: Math.max(0, EXEMPTION_SCORE - latest.score),
  };
}

/** "10 המבחנים האחרונים" / "כל 7 המבחנים" / "המבחן היחיד שלך" — the label every windowed number carries. */
export function windowLabel(w: Pick<AccuracyWindow, 'exams' | 'isAllTime'>): string {
  if (w.exams === 1) return 'המבחן היחיד שלך';
  if (w.isAllTime) return `כל ${w.exams} המבחנים`;
  return `${w.exams} המבחנים האחרונים`;
}

/** The label for the readiness score window. */
export function currentLabel(used: number): string {
  return used === 1 ? 'המבחן האחרון' : `${used} המבחנים האחרונים`;
}

function readiness(rows: StatsRow[], recent: AccuracyWindow): Readiness {
  const reasons: ReadinessReason[] = [];
  const n = rows.length;
  reasons.push({
    ok: n >= 3,
    text: n >= 3 ? `השלמת ${heCount(n, 'exam')}` : `רק ${heCount(n, 'exam')}. צריך לפחות 3 למדידה יציבה`,
    href: n >= 3 ? undefined : '/exam',
  });

  // The actual scores of the last few measured exams; the verdict goes by
  // the lowest of them, so one good day doesn't read as "ready".
  const lastScores = rows.slice(-POOL_WINDOW).map(r => r.score);
  const floorScore = lastScores.length > 0 ? Math.min(...lastScores) : null;
  if (floorScore !== null) {
    const basis = currentLabel(lastScores.length);
    reasons.push(floorScore >= EXEMPTION_SCORE
      ? { ok: true, text: lastScores.length === 1 ? `${basis}: ${floorScore}, ${EXEMPTION_SCORE} ומעלה` : `${basis}: כולם ${EXEMPTION_SCORE} ומעלה` }
      : { ok: false, text: lastScores.length === 1
          ? `${basis}: ${floorScore}. חסרות ${EXEMPTION_SCORE - floorScore} נק׳ ל-${EXEMPTION_SCORE}`
          : `הציון הנמוך מבין ${basis}: ${floorScore}. חסרות ${EXEMPTION_SCORE - floorScore} נק׳ ל-${EXEMPTION_SCORE}` });
  }

  // Stability: the same exams.
  if (lastScores.length >= 2) {
    const spread = Math.max(...lastScores) - Math.min(...lastScores);
    const basis = currentLabel(lastScores.length);
    reasons.push(spread <= 12
      ? { ok: true, text: `יציבות טובה: פער ${spread} נק׳ בין ${basis}` }
      : { ok: false, text: `תנודתיות גבוהה: פער ${spread} נק׳ בין ${basis}. עוד כמה סימולציות ייצבו את התמונה` });
  }

  const win = windowLabel(recent);
  const typed = Object.entries(recent.byType).filter(([, d]) => d.total > 0);
  if (typed.length > 0) {
    const weak = typed.filter(([, d]) => d.correct / d.total < 0.7);
    reasons.push(weak.length === 0
      ? { ok: true, text: `כל סוגי השאלות מעל 70% (${win})` }
      : { ok: false, text: `פחות מ-70% הצלחה (${win}): ${weak.map(([t]) => typeLabel(t)).join(', ')}` });
  }

  const hard = recent.byDifficulty.hard;
  if (hard.total > 0) {
    const r = hard.correct / hard.total;
    reasons.push({ ok: r >= 0.55, text: `שאלות ברמות ${ltr('4–5')} (${win}): ${Math.round(r * 100)}% ${r >= 0.55 ? '(יציב גם ברמות הגבוהות)' : '(כדאי לחזק את הרמות הגבוהות)'}` });
  }

  let timed = 0, over = 0;
  for (const sr of scoredSections(rows.slice(-RECENT_WINDOW))) {
    const t = SECTION_CONFIGS[sr.sectionIndex - 1]?.type ?? sr.type;
    for (const sec of sr.timings ?? []) { timed++; if (sec > (PACE_CAPS[t] ?? 90)) over++; }
  }
  if (timed > 0) {
    reasons.push({
      ok: over / timed <= 0.15,
      text: over === 0
        ? `קצב מצוין (${win}): אף שאלה לא חרגה מתקציב הזמן`
        : `${heCount(over, 'question')} ${agree(over, 'חרגה', 'חרגו')} מתקציב הזמן (${win})`,
    });
  }

  const allOk = reasons.every(r => r.ok);
  const verdict = allOk && n >= 3 && floorScore !== null && floorScore >= EXEMPTION_SCORE
    ? 'ready'
    : n >= 3 && floorScore !== null && floorScore >= 120
    ? 'almost'
    : 'not_yet';
  return { verdict, reasons };
}

/** `rows` are the student's completed real exams, oldest first (as /api/stats returns them). */
export function computeStatsMetrics(rows: StatsRow[]): StatsMetrics | null {
  if (rows.length === 0) return null;
  const scores = rows.map(r => r.score);
  const bestScore = Math.max(...scores);
  const measured = rows.filter(r => !isLowEffortExam(r.section_results));
  const recent = accuracyWindow(rows.slice(-RECENT_WINDOW), rows.length);
  const allTime = accuracyWindow(rows, rows.length);
  return {
    examCount: rows.length,
    bestScore,
    lastScore: scores[scores.length - 1],
    bestClassification: classifyScore(bestScore),
    measured: computeMeasuredScore(measured, rows),
    recent,
    allTime,
    weakest: computeWeakestType(rows),
    readiness: readiness(measured, recent),
    excludedLowEffort: rows.length - measured.length,
  };
}
