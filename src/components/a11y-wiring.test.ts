import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { QuestionCard } from './exam/QuestionCard';
import { SectionProgress } from './exam/SectionProgress';
import type { Question } from '@/types/exam';

/**
 * Screen-reader wiring that has no visual signal, so nothing else would catch
 * it regressing: selected/correct state on answer options, the focusable
 * reading passage, the live result line, and the section-progress steps.
 */

const question = (over: Partial<Question> = {}): Question => ({
  id: 'q1',
  type: 'sentence_completion',
  text: 'The plan was ___ by the committee.',
  options: ['approved', 'denied', 'ignored', 'delayed'].map((text, i) => ({ id: `o${i}`, text })),
  correct_answer: 0,
  a: 1, b: 0, c: 0.25,
  difficulty_level: 3,
  ...over,
});

const card = (props: Partial<Parameters<typeof QuestionCard>[0]>) => renderToStaticMarkup(createElement(QuestionCard, {
  question: question(),
  questionNumber: 1,
  totalInSection: 4,
  selectedAnswer: null,
  onSelect: () => {},
  ...props,
}));

describe('QuestionCard', () => {
  it('exposes which option is selected', () => {
    const html = card({ selectedAnswer: 2 });
    expect(html.match(/aria-pressed="true"/g)).toHaveLength(1);
    expect(html.match(/aria-pressed="false"/g)).toHaveLength(3);
  });

  it('keeps answered options focusable and says which is right and which was yours', () => {
    const html = card({ selectedAnswer: 1, isPractice: true, showResult: true });
    expect(html).not.toMatch(/<button[^>]* disabled/);
    expect(html.match(/aria-disabled="true"/g)).toHaveLength(4);
    expect(html).toContain('(התשובה הנכונה)');
    expect(html).toContain('(התשובה שלך, שגויה)');
  });

  it('has a live status line in practice, empty until the answer locks', () => {
    expect(card({ isPractice: true })).toMatch(/<p role="status"[^>]*><\/p>/);
    expect(card({ isPractice: false })).not.toContain('role="status"');
  });

  it('makes the reading passage a named, focusable region', () => {
    const html = card({ question: question({ type: 'reading_comprehension', passage: { id: 'p', text: 'Once upon a time.', difficulty_level: 3, b: 0 } }) });
    expect(html).toMatch(/tabindex="0" role="region" aria-label="קטע קריאה"/);
  });

  it('marks English content as English', () => {
    expect(card({})).toMatch(/lang="en"[^>]*>The plan was/);
  });
});

describe('SectionProgress', () => {
  it('marks the current step and states each step in words', () => {
    const html = renderToStaticMarkup(createElement(SectionProgress, { currentSection: 3, completedSections: [1, 2] }));
    expect(html.match(/aria-current="step"/g)).toHaveLength(1);
    expect(html).toContain('פרק 1, הושלם:');
    expect(html).toContain('פרק 3, הפרק הנוכחי:');
    expect(html).toMatch(/tabindex="0" role="region" aria-label="התקדמות בפרקי המבחן"/);
  });
});
