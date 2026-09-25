import { describe, expect, it } from 'vitest';
import { EMPTY_FILTERS, activeFilterCount, applyFilters, countFor, filtersFromParams, toggle, type FilterableWord, type VocabFilters } from './vocab-filter';

const w = (id: string, part_of_speech: string, category: string, difficulty_level: number): FilterableWord => ({
  id, word: id, definition: '', hebrew_translation: '', example_sentence: '', part_of_speech, category, difficulty_level,
});

const all = [
  w('hypothesis', 'noun', 'academic', 3),
  w('analyze', 'verb', 'academic', 2),
  w('whereas', 'connector', 'academic', 4),
  w('garrulous', 'adjective', 'general', 5),
  w('however', 'connector', 'general', 1),
  w('decide', 'verb', 'general', 1),
];
const pools = { all, mistakes: [all[3]], favorites: new Set(['analyze', 'however']) };
const f = (over: Partial<VocabFilters>): VocabFilters => ({ ...EMPTY_FILTERS, ...over });
const ids = (x: FilterableWord[]) => x.map(v => v.id);

describe('applyFilters', () => {
  it('shows everything with no filters', () => {
    expect(applyFilters(pools, EMPTY_FILTERS)).toHaveLength(6);
  });

  it('combines academic with a kind of word (the case that showed nothing)', () => {
    expect(ids(applyFilters(pools, f({ academic: true, pos: ['noun'] })))).toEqual(['hypothesis']);
    expect(ids(applyFilters(pools, f({ academic: true, pos: ['connector'] })))).toEqual(['whereas']);
  });

  it('widens inside an axis and narrows across axes', () => {
    expect(ids(applyFilters(pools, f({ pos: ['verb', 'connector'] })))).toEqual(['analyze', 'whereas', 'however', 'decide']);
    expect(ids(applyFilters(pools, f({ pos: ['verb', 'connector'], levels: [1] })))).toEqual(['however', 'decide']);
  });

  it('takes the words from the chosen source', () => {
    expect(ids(applyFilters(pools, f({ source: 'mistakes' })))).toEqual(['garrulous']);
    expect(ids(applyFilters(pools, f({ source: 'favorites', pos: ['verb'] })))).toEqual(['analyze']);
  });
});

describe('countFor', () => {
  it('counts one choice against everything else already chosen', () => {
    const current = f({ academic: true, pos: ['noun'] });
    expect(countFor(pools, current, { pos: ['verb'] })).toBe(1);
    expect(countFor(pools, current, { pos: ['adjective'] })).toBe(0);
    expect(countFor(pools, current, { academic: false })).toBe(1);
  });
});

describe('filtersFromParams', () => {
  const p = (q: string) => filtersFromParams(new URLSearchParams(q));

  it('reads the new parameters', () => {
    expect(p('pos=verb,noun&level=4,5&academic=1&source=favorites')).toEqual(f({ pos: ['verb', 'noun'], levels: [4, 5], academic: true, source: 'favorites' }));
  });

  it('keeps old ?pack= links working', () => {
    expect(p('pack=connectors').pos).toEqual(['connector']);
    expect(p('pack=advanced').levels).toEqual([4, 5]);
    expect(p('pack=my-mistakes').source).toBe('mistakes');
    expect(p('pack=academic').academic).toBe(true);
  });

  it('ignores values it does not know', () => {
    expect(p('pos=pronoun&level=9&source=x')).toEqual(EMPTY_FILTERS);
  });
});

describe('helpers', () => {
  it('toggles and counts active choices', () => {
    expect(toggle(['verb'], 'noun')).toEqual(['verb', 'noun']);
    expect(toggle(['verb', 'noun'], 'verb')).toEqual(['noun']);
    expect(activeFilterCount(f({ academic: true, pos: ['verb', 'noun'], search: ' x ' }))).toBe(4);
  });
});
