import { describe, expect, it } from 'vitest';
import {
  CHANGE_ANSWER_RULE, GUIDE_BY_ID, QUESTION_GUIDES, RESTATEMENT_GUARDS, TOO_SIMILAR_RULE, type LayeredRule,
  GAME_RULES, TIME_BUDGET, INVEST_POINTS, CONNECTOR_CATEGORIES, TOPIC_KEYLINES, TOPICS, TOPIC_GROUPS,
  RULES_INTRO, TIME_INTRO, CONNECTORS_INTRO, INVEST_INTRO, METHODS_INTRO, HABITS_INTRO,
} from './strategies';
import { isWholeSentenceRun } from '@/lib/sentences';

describe('keyLines are verbatim whole sentences of the text they summarize', () => {
  const cases: [string, string, string][] = [
    ...GAME_RULES.map(r => [`rule: ${r.title}`, r.keyLine, r.body] as [string, string, string]),
    ...TIME_BUDGET.map(r => [`time: ${r.id}`, r.keyLine, r.note] as [string, string, string]),
    ...INVEST_POINTS.map(p => [`invest: ${p.title}`, p.keyLine, p.body] as [string, string, string]),
    ...CONNECTOR_CATEGORIES.map(c => [`connectors: ${c.id}`, c.keyLine, c.intro] as [string, string, string]),
    ...QUESTION_GUIDES.map(g => [`guide: ${g.id}`, g.keyLine, g.intro] as [string, string, string]),
    ['topic: rules', TOPIC_KEYLINES.rules, RULES_INTRO],
    ['topic: time', TOPIC_KEYLINES.time, TIME_INTRO],
    ['topic: connectors', TOPIC_KEYLINES.connectors, CONNECTORS_INTRO],
    ['topic: invest', TOPIC_KEYLINES.invest, INVEST_INTRO],
    ['topic: methods', TOPIC_KEYLINES.methods, METHODS_INTRO],
    ['topic: habits', TOPIC_KEYLINES.habits, HABITS_INTRO],
  ];

  it.each(cases)('%s', (_label, keyLine, source) => {
    expect(source).toContain(keyLine);
    expect(isWholeSentenceRun(keyLine, source)).toBe(true);
  });

  it('rejects a shortened excerpt (the check is not just "contains")', () => {
    expect(isWholeSentenceRun('מילת הקישור היא התמרור.', CONNECTORS_INTRO)).toBe(false);
    expect(isWholeSentenceRun('מילת הקישור היא התמרור הזה.', CONNECTORS_INTRO)).toBe(true);
  });
});

describe('connector cheat-sheet chips are backed by the word\'s own grammar text', () => {
  const words = CONNECTOR_CATEGORIES.flatMap(c => c.words);

  it.each(words.filter(w => w.pattern).map(w => [w.word, w] as const))('%s', (_word, w) => {
    expect(w.grammar).toContain(w.pattern!.basis);
  });

  it('leaves a word without a chip when its grammar text states no rule', () => {
    expect(words.find(w => w.word === 'whereas / while')!.pattern).toBeUndefined();
  });
});

describe('topic index', () => {
  it('groups every topic exactly once', () => {
    const grouped = TOPIC_GROUPS.flatMap(g => g.ids);
    expect([...grouped].sort()).toEqual(TOPICS.map(t => t.id).sort());
    expect(new Set(grouped).size).toBe(grouped.length);
  });

  it('gives every topic its own icon', () => {
    expect(new Set(TOPICS.map(t => t.icon)).size).toBe(TOPICS.length);
  });
});

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
