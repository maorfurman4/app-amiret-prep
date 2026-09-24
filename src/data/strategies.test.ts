import { describe, expect, it } from 'vitest';
import {
  CHANGE_ANSWER_RULE, GUIDE_BY_ID, QUESTION_GUIDES, RESTATEMENT_GUARDS, TOO_SIMILAR_RULE, type LayeredRule,
} from './strategies';

const LAYERED: LayeredRule[] = [...RESTATEMENT_GUARDS, TOO_SIMILAR_RULE, CHANGE_ANSWER_RULE];

describe('layered rules (rule → why → example)', () => {
  it.each(LAYERED.map(r => [r.id, r] as const))('%s has all three layers', (_id, r) => {
    expect(r.title.trim()).not.toBe('');
    expect(r.rule.trim()).not.toBe('');
    expect(r.why.trim()).not.toBe('');
    if (r.example.kind === 'pair') {
      for (const part of [r.example.source, r.example.correct, r.example.trap, r.example.note]) {
        expect(part.trim()).not.toBe('');
      }
    } else {
      expect(r.example.text.trim()).not.toBe('');
    }
  });

  it('keeps layer 1 to one short line', () => {
    for (const r of LAYERED) expect(r.rule.length, r.id).toBeLessThanOrEqual(70);
  });

  it('keeps layer 2 deeper than layer 1', () => {
    for (const r of LAYERED) expect(r.why.length, r.id).toBeGreaterThan(r.rule.length);
  });

  it('uses unique ids', () => {
    expect(new Set(LAYERED.map(r => r.id)).size).toBe(LAYERED.length);
  });

  it('makes every minimal pair a real pair — three distinct sentences', () => {
    for (const r of LAYERED) {
      if (r.example.kind !== 'pair') continue;
      const { source, correct, trap } = r.example;
      expect(new Set([source, correct, trap]).size, r.id).toBe(3);
    }
  });

  it('highlights phrases that actually occur in each sentence', () => {
    for (const r of LAYERED) {
      if (r.example.kind !== 'pair') continue;
      const { source, correct, trap, highlight } = r.example;
      const sentences = { source, correct, trap };
      for (const key of ['source', 'correct', 'trap'] as const) {
        expect(highlight[key].length, `${r.id}.${key}`).toBeGreaterThan(0);
        for (const phrase of highlight[key]) expect(sentences[key], `${r.id}.${key}`).toContain(phrase);
      }
    }
  });

  it('cites a source for the empirical answer-changing claim', () => {
    expect(CHANGE_ANSWER_RULE.source).toMatch(/Kruger/);
  });
});

describe('rendered content derives from the layered rules', () => {
  it('renders all eight guards and both precision rules as layered cards on the restatement page', () => {
    const sections = GUIDE_BY_ID.restatement.deep.layered!;
    expect(sections[0].rules).toBe(RESTATEMENT_GUARDS);
    expect(sections[1].rules).toEqual([TOO_SIMILAR_RULE, CHANGE_ANSWER_RULE]);
    expect(GUIDE_BY_ID.restatement.deep.tips).toBeUndefined();
  });

  it('uses the softened similarity rule, not the old "too similar = trap" heuristic', () => {
    const steps = GUIDE_BY_ID.restatement.approach.map(s => s.detail).join(' ');
    expect(steps).toContain(TOO_SIMILAR_RULE.rule);
    expect(steps).not.toMatch(/80%/);
  });

  it('ends every rescue protocol with the answer-changing rule', () => {
    for (const g of QUESTION_GUIDES) {
      expect(g.stuck.some(s => s.detail === CHANGE_ANSWER_RULE.rule), g.id).toBe(true);
    }
  });
});
