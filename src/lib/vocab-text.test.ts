import { describe, expect, it } from 'vitest';
import { cleanSnippet } from './vocab-text';

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
