import { describe, expect, it } from 'vitest';
import { activeDeck, emptyDeckState } from './vocab-deck';

const words = [{ id: 'a' }, { id: 'b' }, { id: 'c' }];
const now = new Date('2026-10-01T12:00:00Z');

describe('activeDeck', () => {
  it('keeps unknown words and drops known words that are not yet due', () => {
    const deck = activeDeck(words, new Set(['a']), { a: { interval_days: 2, next_review_at: '2026-10-03T00:00:00Z' } }, now);
    expect(deck.map(w => w.id)).toEqual(['b', 'c']);
  });

  it('brings a known word back once it is due', () => {
    const deck = activeDeck(words, new Set(['a']), { a: { interval_days: 1, next_review_at: '2026-09-30T00:00:00Z' } }, now);
    expect(deck.map(w => w.id)).toEqual(['a', 'b', 'c']);
  });

  it('keeps a known word with no schedule entry', () => {
    expect(activeDeck(words, new Set(['a']), {}, now)).toHaveLength(3);
  });
});

describe('emptyDeckState', () => {
  it('is "building", not "finished", before the first deck build — the reload-from-cache case', () => {
    // Words are loaded and some are known, but the deck hasn't been built yet.
    expect(emptyDeckState({ deckBuilt: false, scopeCount: 1750, knownCount: 3 })).toBe('building');
  });

  it('is "finished" only once a built deck is genuinely exhausted', () => {
    expect(emptyDeckState({ deckBuilt: true, scopeCount: 1750, knownCount: 1750 })).toBe('finished');
  });

  it('is "no-matches" when the filter leaves nothing', () => {
    expect(emptyDeckState({ deckBuilt: true, scopeCount: 0, knownCount: 3 })).toBe('no-matches');
  });
});
