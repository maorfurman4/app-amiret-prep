import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import { SECTION_CONFIGS, type SectionResult } from '@/types/exam';

// Page chrome isn't under test.
vi.mock('@/components/BackNav', () => ({ BackNav: () => null }));
import { ResultsView, type ResultsSession } from './ResultsView';

/** A finished exam: `right(section, q)` decides each answer, `seconds` each timing. */
function session(score: number, right: (s: number, q: number) => boolean, seconds = 60, sections = SECTION_CONFIGS): ResultsSession {
  const theta = (score - 100) / 20;
  return {
    score,
    theta_final: theta,
    theta_se: 0.35,
    theta_history: [],
    section_results: sections.map(cfg => {
      const questions = Array.from({ length: cfg.questionCount }, (_, q) => ({ id: `${cfg.index}-${q}`, correct_answer: 0, difficulty_level: 3 }));
      const answers = questions.map((_, q) => (right(cfg.index, q) ? 0 : 1));
      return {
        sectionIndex: cfg.index, type: cfg.type, questions, answers, timings: answers.map(() => seconds),
        thetaBefore: theta, thetaAfter: theta, correctCount: answers.filter(a => a === 0).length, totalCount: questions.length,
      };
    }) as unknown as SectionResult[],
    answers_by_section: {},
    questions_by_section: {},
    is_practice: false,
  };
}

const render = (s: ResultsSession) => renderToStaticMarkup(createElement(ResultsView, { session: s, sessionId: 'x' }));
const metric = (html: string, name: string) =>
  [...html.matchAll(new RegExp(`data-metric="${name}"[^>]*>(.*?)</(?:p|dd|bdi)>`, 'g'))].map(m => m[1].replace(/<[^>]+>/g, ''));

describe('ResultsView hero', () => {
  it('shows the score once and the distance to 134, warmly', () => {
    const html = render(session(118, (_, q) => q < 2));
    expect(metric(html, 'headline-score')).toEqual(['118']);
    expect(metric(html, 'points-to-target')[0]).toBe('עוד 16 נקודות לפטור. אתה בדרך.');
  });

  it('one point short reads as one point', () => {
    expect(metric(render(session(133, () => true)), 'points-to-target')[0]).toBe('חסרה נקודה אחת לפטור. אתה בדרך.');
  });

  it('a pass says so and marks the knob as passed; below 134 it does not', () => {
    const pass = render(session(138, () => true));
    expect(metric(pass, 'points-to-target')[0]).toContain('עברת את רף ה-134');
    expect(pass).toMatch(/data-passed="" class="score-knob/);
    expect(render(session(118, () => true))).not.toContain('data-passed');
  });

  it('keeps the adaptive-scoring note, and the experimental note only when that section exists', () => {
    const html = render(session(118, () => true));
    expect(html).toContain('data-testid="adaptive-scoring-note"');
    expect(html).toContain('התרגול החלופי מוצג בנפרד');
    const scoredOnly = render(session(118, () => true, 60, SECTION_CONFIGS.filter(c => !c.experimental)));
    expect(scoredOnly).not.toContain('התרגול החלופי מוצג בנפרד');
  });
});

describe('ResultsView page', () => {
  it('highlights exactly the bracket the score falls in', () => {
    const html = render(session(118, () => true));
    const current = [...html.matchAll(/<li aria-current="true"[^>]*>(.*?)<\/li>/g)];
    expect(current).toHaveLength(1);
    expect(current[0][1]).toContain('100–119');
    expect(current[0][1]).toContain('118');
  });

  it('colors accuracy on the /stats scale (80/60): 75% is amber, not green', () => {
    // Sentence completion: 3 of every 4 right → 9/12 = 75%.
    const html = render(session(118, (_, q) => q !== 3));
    const sc = html.match(/<li data-type="sentence_completion">(.*?)<\/li>/)![1];
    expect(sc).toContain('75%');
    expect(sc).toContain('text-exam-alt');
    expect(sc).not.toContain('text-exam-sage-strong');
  });

  it('uses Heebo tabular numbers, no monospace, and no load cascade', () => {
    const html = render(session(118, () => true));
    expect(html).not.toContain('font-mono');
    expect(html).not.toMatch(/animate-(fade-up|ambient-glow|check-pop|score-reveal)/);
  });

  it('a perfect exam is internally consistent: 150 in the hero, 100% and 23/23 everywhere (Fix C)', () => {
    const html = render(session(150, () => true));
    // Hero score and correct-count agree with a clean sweep of the 23 scored items.
    expect(metric(html, 'headline-score')).toEqual(['150']);
    expect(metric(html, 'correct-count')).toEqual(['23 מתוך 23']);
    // Every per-type row reads 100%…
    const typeRows = [...html.matchAll(/<li data-type="[^"]+">(.*?)<\/li>/g)].map(m => m[1]);
    expect(typeRows.length).toBeGreaterThan(0);
    typeRows.forEach(row => expect(row).toContain('100%'));
    // …and every scored per-section row does too (the experimental one included,
    // it was answered, not skipped).
    const sectionRows = [...html.matchAll(/<li class="flex items-center gap-3" data-section="\d+">(.*?)<\/li>/g)].map(m => m[1]);
    expect(sectionRows.length).toBe(SECTION_CONFIGS.length);
    sectionRows.forEach(row => { expect(row).toContain('100%'); expect(row).not.toContain('דילגת'); });
  });
});
