import { describe, expect, it } from 'vitest';
import { pickContextualTip, type SessionItem } from './strategy-tip';
import { GUIDE_BY_ID } from '@/data/strategies';

const item = (type: SessionItem['type'], correct: boolean, id = `${type}-${correct}`): SessionItem => ({ id, type, correct });

describe('pickContextualTip', () => {
  it('targets the type with the most errors', () => {
    const tip = pickContextualTip([
      item('sentence_completion', false, 'a'),
      item('restatement', false, 'b'),
      item('restatement', false, 'c'),
      item('reading_comprehension', true, 'd'),
    ]);
    expect(tip?.guide.id).toBe('restatement');
    expect(tip?.errors).toBe(2);
    expect(tip?.total).toBe(2);
  });

  it('breaks an error-count tie by error rate', () => {
    const tip = pickContextualTip([
      item('sentence_completion', false, 'a'),
      item('sentence_completion', true, 'b'),
      item('sentence_completion', true, 'c'),
      item('restatement', false, 'd'),
    ]);
    expect(tip?.guide.id).toBe('restatement');
  });

  it('still returns a tip for a flawless session, for the most-practiced type', () => {
    const tip = pickContextualTip([
      item('reading_comprehension', true, 'a'),
      item('reading_comprehension', true, 'b'),
      item('sentence_completion', true, 'c'),
    ]);
    expect(tip?.guide.id).toBe('reading-comprehension');
    expect(tip?.errors).toBe(0);
  });

  it('draws the tip from that type\'s stuck protocol, stably per session', () => {
    const session = [item('sentence_completion', false, 'q1'), item('sentence_completion', false, 'q2')];
    const first = pickContextualTip(session);
    expect(GUIDE_BY_ID['sentence-completion'].stuck).toContain(first?.tip);
    expect(pickContextualTip(session)?.tip).toBe(first?.tip);
  });

  it('ignores types without a guide and returns null when nothing is left', () => {
    expect(pickContextualTip([item('esra', false)])).toBeNull();
    expect(pickContextualTip([])).toBeNull();
  });
});
