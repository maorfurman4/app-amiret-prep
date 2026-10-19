import { describe, expect, it } from 'vitest';
import { blankLabel } from './section-practice';

describe('blankLabel', () => {
  it('says the time ran out only when the timer ended the section', () => {
    expect(blankLabel(true)).toBe('לא ענית, הזמן נגמר');
  });
  it('does not blame the clock for a section finished early', () => {
    expect(blankLabel(false)).toBe('לא ענית');
    expect(blankLabel(false)).not.toContain('הזמן');
  });
});
