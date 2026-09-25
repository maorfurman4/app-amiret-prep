import { describe, expect, it } from 'vitest';
import { agree, heCount } from './hebrew-count';

describe('heCount', () => {
  it('uses "אחד/אחת" after the noun for one', () => {
    expect(heCount(1, 'question')).toBe('שאלה אחת');
    expect(heCount(1, 'day')).toBe('יום אחד');
    expect(heCount(1, 'exam')).toBe('מבחן אחד');
  });

  it('uses the dual or "שני/שתי" for two', () => {
    expect(heCount(2, 'day')).toBe('יומיים');
    expect(heCount(2, 'question')).toBe('שתי שאלות');
    expect(heCount(2, 'exam')).toBe('שני מבחנים');
    expect(heCount(2, 'minute')).toBe('שתי דקות');
  });

  it('uses digits and the plural from three up (and for zero)', () => {
    expect(heCount(3, 'question')).toBe('3 שאלות');
    expect(heCount(12, 'day')).toBe('12 ימים');
    expect(heCount(0, 'word')).toBe('0 מילים');
  });
});

describe('agree', () => {
  it('picks the form that agrees with the count', () => {
    expect(agree(1, 'חרגה', 'חרגו')).toBe('חרגה');
    expect(agree(4, 'חרגה', 'חרגו')).toBe('חרגו');
  });
});
