import { isDue } from './spaced-repetition';

export type ScheduleMap = Record<string, { interval_days: number; next_review_at: string }>;

/**
 * The flashcard deck for a set of (already filtered, already shuffled)
 * words: everything not marked known, plus known words whose
 * spaced-repetition interval says they're due for review again.
 */
export function activeDeck<W extends { id: string }>(
  words: W[],
  known: Set<string>,
  schedule: ScheduleMap,
  now: Date = new Date(),
): W[] {
  return words.filter(w => {
    if (!known.has(w.id)) return true;
    const sched = schedule[w.id];
    return !sched || isDue(sched.next_review_at, now);
  });
}

/**
 * What an empty flashcard deck means. `deckBuilt` is false until the deck has
 * been built at least once from the loaded word list — before that an empty
 * deck just means "not built yet" and must never read as "you finished every
 * card" (a reload from the cached word list used to land there).
 */
export function emptyDeckState({ deckBuilt, scopeCount, knownCount }: {
  deckBuilt: boolean;
  scopeCount: number;
  knownCount: number;
}): 'building' | 'finished' | 'no-matches' {
  if (!deckBuilt) return 'building';
  return scopeCount > 0 && knownCount > 0 ? 'finished' : 'no-matches';
}
