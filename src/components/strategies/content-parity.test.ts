/**
 * Content parity: every text field in src/data/strategies.ts must reach the
 * rendered guide. Folded (collapsed) sections stay in the DOM, so they count.
 * Strings are collected generically — a field added to the data later is
 * covered without touching this test; only non-copy keys are skipped.
 */
import { describe, expect, it, vi } from 'vitest';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

// BackNav pulls in the Supabase-backed user menu; it carries no strategy copy.
vi.mock('@/components/BackNav', () => ({ BackNav: () => null }));

import StrategiesPage from '@/app/strategies/page';
import { StrategyTopic } from '@/components/strategies/StrategyTopic';
import { TipsGuide } from '@/components/strategies/TipsGuide';
import * as S from '@/data/strategies';

/** Keys that hold ids, routes, styling, numbers or authoring metadata — not copy the student reads. */
const NOT_COPY = new Set([
  'id', 'href', 'tipsHref', 'icon', 'tone', 'color', 'kind', 'highlight', 'plan', 'numbered',
  'correctIndex', 'recommended', 'showTimeBudget', 'basis', 'cardDesc',
]);

function collect(value: unknown, out: string[] = [], skip: Set<string> = NOT_COPY): string[] {
  if (typeof value === 'string') out.push(value);
  else if (Array.isArray(value)) value.forEach(v => collect(v, out, skip));
  else if (value && typeof value === 'object') {
    for (const [k, v] of Object.entries(value)) if (!skip.has(k)) collect(v, out, skip);
  }
  return out;
}

const decode = (s: string) => s
  .replace(/&quot;/g, '"').replace(/&#x27;|&#39;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>')
  .replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&');

/**
 * Rendered text with every tag and all whitespace removed: RichText wraps
 * English in <bdi> and prose is split into <p>s, so spacing around tags
 * shifts — the characters, in order, must not.
 */
const flat = (s: string) => s.replace(/\s+/g, '');
const renderedText = (el: Parameters<typeof renderToStaticMarkup>[0]) =>
  flat(decode(renderToStaticMarkup(el).replace(/<[^>]*>/g, '')));
const expected = (s: string) => flat(s.replace(/\*\*/g, ''));

function missing(strings: string[], text: string) {
  return strings.filter(s => !text.includes(expected(s)));
}

const QUESTION_TYPES: S.QuestionTypeId[] = ['sentence-completion', 'restatement', 'reading-comprehension'];

/** What each /strategies topic owns in the data. */
const TOPIC_CONTENT: Record<S.TopicId, unknown> = {
  rules: [S.RULES_INTRO, S.TOPIC_KEYLINES.rules, S.GAME_RULES],
  time: [S.TIME_INTRO, S.TOPIC_KEYLINES.time, S.TIME_BUDGET],
  'sentence-completion': { ...S.GUIDE_BY_ID['sentence-completion'], deep: undefined },
  restatement: { ...S.GUIDE_BY_ID.restatement, deep: undefined },
  'reading-comprehension': { ...S.GUIDE_BY_ID['reading-comprehension'], deep: undefined },
  connectors: [S.CONNECTORS_INTRO, S.CONNECTORS_OUTRO, S.CONNECTORS_KEYLINE, S.CONNECTOR_CATEGORIES],
  invest: [S.INVEST_INTRO, S.TOPIC_KEYLINES.invest, S.INVEST_POINTS],
  methods: [S.METHODS_INTRO, S.TOPIC_KEYLINES.methods, S.MARKET_METHODS],
  habits: [S.HABITS_INTRO, S.TOPIC_KEYLINES.habits, S.HABITS],
};

describe('content parity — /strategies', () => {
  it.each(S.TOPICS.map(t => [t.id] as const))('topic %s renders every text field it owns', id => {
    const strings = collect(TOPIC_CONTENT[id]);
    expect(strings.length).toBeGreaterThan(3);
    expect(missing(strings, renderedText(createElement(StrategyTopic, { id })))).toEqual([]);
  });

  it('the index renders every topic title, description and group', () => {
    const strings = collect([S.TOPICS, S.TOPIC_GROUPS.map(g => g.title)]);
    expect(missing(strings, renderedText(createElement(StrategiesPage)))).toEqual([]);
  });

  it('can fail: reports copy that is not rendered', () => {
    const rules = renderedText(createElement(StrategyTopic, { id: 'rules' }));
    expect(missing([S.CONNECTORS_OUTRO, 'משפט שלא קיים באף מקום במדריך'], rules)).toHaveLength(2);
  });

  it('covers every exported copy block (no topic left unchecked)', () => {
    const owned = new Set(collect(Object.values(TOPIC_CONTENT)));
    const guideCopy = collect(S.QUESTION_GUIDES.map(g => ({ ...g, deep: undefined })));
    for (const s of guideCopy) expect(owned.has(s), s.slice(0, 40)).toBe(true);
  });
});

describe('content parity — /tips/*', () => {
  it.each(QUESTION_TYPES.map(t => [t] as const))('%s renders every text field of its deep guide', type => {
    const deep = S.GUIDE_BY_ID[type].deep;
    const time = deep.showTimeBudget ? S.TIME_BY_TYPE[type] : null;
    const strings = collect([
      S.GUIDE_BY_ID[type].titleHe,
      deep,
      time && { total: time.total, perQ: time.perQ, stuckCap: time.stuckCap, note: time.note },
    ]);
    expect(missing(strings, renderedText(createElement(TipsGuide, { type })))).toEqual([]);
  });
});
