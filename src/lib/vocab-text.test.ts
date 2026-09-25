import { describe, expect, it } from 'vitest';
import { cleanSnippet, extractGloss } from './vocab-text';

describe('cleanSnippet', () => {
  it('drops the final period of a definition', () => {
    expect(cleanSnippet('The method and practice of teaching.')).toBe('The method and practice of teaching');
    expect(cleanSnippet('To produce or create something')).toBe('To produce or create something');
  });

  it('removes wrapping quote marks', () => {
    expect(cleanSnippet('"Effective pedagogy engages students actively."', { keepPeriod: true })).toBe('Effective pedagogy engages students actively.');
    expect(cleanSnippet('“A credulous audience”')).toBe('A credulous audience');
  });

  it('keeps ellipses, questions and exclamations', () => {
    expect(cleanSnippet('Not simply...')).toBe('Not simply...');
    expect(cleanSnippet('Is it fair?')).toBe('Is it fair?');
    expect(cleanSnippet('Watch out!')).toBe('Watch out!');
  });

  it('keeps inner quotes and apostrophes', () => {
    expect(cleanSnippet("The author's \"fair\" point.")).toBe("The author's \"fair\" point");
  });

  it('handles empty input', () => {
    expect(cleanSnippet(null)).toBe('');
    expect(cleanSnippet('')).toBe('');
  });
});

describe('extractGloss', () => {
  it('reads the current "word (תרגום)" format', () => {
    expect(extractGloss('despite (למרות). הצוות המשיך לעבוד למרות הגשם.')).toBe('למרות');
    expect(extractGloss('נכון! premature (מוקדם מדי/פזיז). המסקנות נסתרו.')).toBe('מוקדם מדי/פזיז');
  });

  it('still reads the older "word = תרגום" format', () => {
    expect(extractGloss('abandon = לנטוש. מחסור במימון.')).toBe('לנטוש');
  });

  it('skips English-only parentheses and handles empty input', () => {
    expect(extractGloss('will be (future passive) — ייבדק (ייבדק)')).toBe('ייבדק');
    expect(extractGloss('no gloss here')).toBe('');
    expect(extractGloss(null)).toBe('');
  });
});
