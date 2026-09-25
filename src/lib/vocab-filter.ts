import { PARTS_OF_SPEECH, partOfSpeechOf, type PartOfSpeech } from './part-of-speech';

/**
 * The vocabulary filter: four independent questions, each answered on its
 * own axis.
 *
 *   source    — which words:     all / the ones I got wrong / my favorites (one)
 *   academic  — academic only:   on / off
 *   pos       — kind of word:    any of noun, verb, adjective, adverb, connector
 *   levels    — difficulty:      any of 1–5
 *
 * Inside an axis the choices widen the result (verbs OR nouns); across axes
 * they narrow it (academic AND verbs AND level 4). An empty multi-select axis
 * means "no limit".
 */
export type Source = 'all' | 'mistakes' | 'favorites';

export interface VocabFilters {
  source: Source;
  academic: boolean;
  pos: PartOfSpeech[];
  levels: number[];
  search: string;
}

export const LEVELS = [1, 2, 3, 4, 5] as const;

export const EMPTY_FILTERS: VocabFilters = { source: 'all', academic: false, pos: [], levels: [], search: '' };

export interface FilterableWord {
  id: string;
  word: string;
  definition: string;
  hebrew_translation: string;
  example_sentence: string;
  category: string;
  part_of_speech?: string | null;
  difficulty_level: number;
}

export interface FilterPools<W extends FilterableWord> {
  all: W[];
  mistakes: W[];
  favorites: Set<string>;
}

function poolFor<W extends FilterableWord>(source: Source, pools: FilterPools<W>): W[] {
  if (source === 'mistakes') return pools.mistakes;
  if (source === 'favorites') return pools.all.filter(w => pools.favorites.has(w.id));
  return pools.all;
}

function matchesSearch(w: FilterableWord, search: string): boolean {
  const q = search.trim().toLowerCase();
  if (!q) return true;
  return w.word.toLowerCase().includes(q)
    || w.hebrew_translation.includes(q)
    || w.definition.toLowerCase().includes(q)
    || w.example_sentence.toLowerCase().includes(q);
}

function matches(w: FilterableWord, f: VocabFilters): boolean {
  if (f.academic && w.category !== 'academic') return false;
  if (f.pos.length) {
    const pos = partOfSpeechOf(w);
    if (!pos || !f.pos.includes(pos)) return false;
  }
  if (f.levels.length && !f.levels.includes(w.difficulty_level)) return false;
  return matchesSearch(w, f.search);
}

export function applyFilters<W extends FilterableWord>(pools: FilterPools<W>, f: VocabFilters): W[] {
  return poolFor(f.source, pools).filter(w => matches(w, f));
}

/**
 * How many words a single choice would show, given everything else already
 * chosen: its own axis is replaced by just that choice. Drives the number on
 * every chip, and disables chips that would lead to nothing.
 */
export function countFor<W extends FilterableWord>(pools: FilterPools<W>, f: VocabFilters, choice: Partial<VocabFilters>): number {
  return applyFilters(pools, { ...f, ...choice }).length;
}

export function toggle<T>(list: T[], item: T): T[] {
  return list.includes(item) ? list.filter(x => x !== item) : [...list, item];
}

export function activeFilterCount(f: VocabFilters): number {
  return (f.source !== 'all' ? 1 : 0) + (f.academic ? 1 : 0) + f.pos.length + f.levels.length + (f.search.trim() ? 1 : 0);
}

export function isFiltered(f: VocabFilters): boolean {
  return activeFilterCount(f) > 0;
}

/** Old ?pack= links (strategy tips, bookmarks) mapped onto the new axes. */
const LEGACY_PACKS: Record<string, Partial<VocabFilters>> = {
  'my-mistakes': { source: 'mistakes' },
  favorites: { source: 'favorites' },
  academic: { academic: true },
  advanced: { levels: [4, 5] },
  easy: { levels: [1, 2] },
  connectors: { pos: ['connector'] },
  verbs: { pos: ['verb'] },
  nouns: { pos: ['noun'] },
  adjectives: { pos: ['adjective'] },
};

/** Reads ?source=, ?academic=1, ?pos=verb,noun, ?level=4,5 and legacy ?pack=. */
export function filtersFromParams(params: { get(name: string): string | null }): VocabFilters {
  const f: VocabFilters = { ...EMPTY_FILTERS, pos: [], levels: [] };
  const pack = params.get('pack');
  if (pack && LEGACY_PACKS[pack]) Object.assign(f, LEGACY_PACKS[pack]);
  const source = params.get('source');
  if (source === 'mistakes' || source === 'favorites') f.source = source;
  if (params.get('academic') === '1') f.academic = true;
  const pos = (params.get('pos') ?? '').split(',').filter((p): p is PartOfSpeech => (PARTS_OF_SPEECH as readonly string[]).includes(p));
  if (pos.length) f.pos = pos;
  const levels = (params.get('level') ?? '').split(',').map(Number).filter(n => (LEVELS as readonly number[]).includes(n));
  if (levels.length) f.levels = levels;
  return f;
}
