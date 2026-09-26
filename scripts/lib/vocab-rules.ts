/**
 * Shared rules for adding words to public.vocabulary (used by
 * insert-vocab-batch.ts and archive-replace-vocab.ts): allowed values, clean
 * text, duplicates and word families against every existing word (active or
 * archived — the word column is unique across both).
 */
import type { SupabaseClient } from '@supabase/supabase-js';

export const LEVEL_TARGET = 350;
export const PAGE = 1000;
const PARTS = ['noun', 'verb', 'adjective', 'adverb', 'connector'];
const CATEGORIES = ['academic', 'general'];
const FIELDS = ['word', 'hebrew_translation', 'definition', 'example_sentence', 'part_of_speech', 'category', 'difficulty_level'];
const HEBREW = /[֐-׿]/;
const QUOTES = /["“”„«»]/;

export type NewWord = {
  word: string; hebrew_translation: string; definition: string; example_sentence: string;
  part_of_speech: string; category: string; difficulty_level: number;
};
export type Existing = { id: string; word: string; difficulty_level: number; category?: string; part_of_speech?: string | null; is_archived?: boolean };

/**
 * Every word, with is_archived when the column exists (before migration
 * 20260926090000 every word counts as active).
 */
export async function fetchAllWords(supabase: SupabaseClient): Promise<Existing[]> {
  const rows: Existing[] = [];
  let columns = 'id, word, difficulty_level, category, part_of_speech, is_archived';
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await supabase.from('vocabulary').select(columns).order('id').range(from, from + PAGE - 1);
    if (error && /is_archived/.test(error.message) && columns.includes('is_archived')) { columns = 'id, word, difficulty_level, category, part_of_speech'; from -= PAGE; continue; }
    if (error) throw error;
    rows.push(...((data ?? []) as unknown as Existing[]));
    if ((data ?? []).length < PAGE) return rows;
  }
}

export const isActive = (w: Existing) => !w.is_archived;

/** Active words per level, 1–5. */
export const levelCounts = (list: { difficulty_level: number }[]) => [1, 2, 3, 4, 5].map(l => list.filter(x => x.difficulty_level === l).length);

/** Rough family key: strips common suffixes so explain / explanation, common / commonly meet. */
export function familyKey(word: string): string {
  let w = word.toLowerCase().trim();
  for (const suf of ['ations', 'ation', 'ments', 'ment', 'nesses', 'ness', 'ities', 'ity', 'ively', 'ive', 'ally', 'ly', 'ing', 'ed', 'es', 's', 'ion', 'al', 'e', 'y']) {
    if (w.endsWith(suf) && w.length - suf.length >= 4) { w = w.slice(0, -suf.length); break; }
  }
  return w;
}

/** explain / explanation, common / commonly: a long shared start relative to the shorter word. */
export function sameFamily(a: string, b: string): boolean {
  const x = a.toLowerCase(), y = b.toLowerCase();
  if (x === y || x.includes(' ') || y.includes(' ')) return false;
  let n = 0;
  while (n < x.length && n < y.length && x[n] === y[n]) n++;
  return n >= Math.max(5, Math.min(x.length, y.length) - 2);
}

export function usesWord(example: string, word: string): boolean {
  const stem = familyKey(word).slice(0, Math.max(4, familyKey(word).length - 1));
  return example.toLowerCase().includes(word.toLowerCase()) || example.toLowerCase().includes(stem);
}

/**
 * Checks new words. Duplicates and families are checked against `existing`
 * (every word, archived too). `activeAfter` is the active count per level
 * once the whole operation is done, before these rows are added; no level
 * may pass LEVEL_TARGET.
 */
export function validateNewWords(batch: unknown, existing: Existing[], allowFamily: Set<string>, activeAfter: number[]): { errors: string[]; family: string[]; rows: NewWord[] } {
  const errors: string[] = [];
  const family: string[] = [];
  if (!Array.isArray(batch)) return { errors: ['The batch must be a JSON array'], family, rows: [] };
  const rows = batch as NewWord[];
  const dbWords = new Map(existing.map(e => [e.word.toLowerCase(), e]));
  const dbFamilies = new Map<string, string[]>();
  for (const e of existing) {
    const k = familyKey(e.word);
    dbFamilies.set(k, [...(dbFamilies.get(k) ?? []), e.word]);
  }
  const seen = new Set<string>();

  rows.forEach((r, i) => {
    const at = `#${i + 1} "${(r as NewWord)?.word ?? '?'}"`;
    // Shape first, per row: a row that fails it is not checked further, but
    // every other row still is.
    const shape: string[] = [];
    const keys = Object.keys(r ?? {}).sort();
    if (keys.join() !== [...FIELDS].sort().join()) shape.push(`${at}: fields must be exactly ${FIELDS.join(', ')}`);
    for (const f of FIELDS.filter(f => f !== 'difficulty_level')) {
      const v = (r as Record<string, unknown>)[f];
      if (typeof v !== 'string' || !v.trim() || v !== v.trim()) shape.push(`${at}: ${f} must be a non-empty string without surrounding spaces`);
    }
    if (shape.length) { errors.push(...shape); return; }
    const w = r.word.toLowerCase();
    if (!/^[a-z][a-z' -]*[a-z]$/.test(r.word)) errors.push(`${at}: word must be lowercase English letters (spaces, hyphens and apostrophes allowed)`);
    if (!PARTS.includes(r.part_of_speech)) errors.push(`${at}: part_of_speech must be one of ${PARTS.join(', ')}`);
    if (!CATEGORIES.includes(r.category)) errors.push(`${at}: category must be academic or general`);
    if (!Number.isInteger(r.difficulty_level) || r.difficulty_level < 1 || r.difficulty_level > 5) errors.push(`${at}: difficulty_level must be 1–5`);
    if (!HEBREW.test(r.hebrew_translation)) errors.push(`${at}: hebrew_translation has no Hebrew`);
    if (HEBREW.test(r.definition)) errors.push(`${at}: definition must be English`);
    if (/\.$/.test(r.definition)) errors.push(`${at}: definition ends with a period`);
    if (QUOTES.test(r.definition) || QUOTES.test(r.example_sentence)) errors.push(`${at}: quote marks in definition or example`);
    if (!/[.?!]$/.test(r.example_sentence)) errors.push(`${at}: example must be a full sentence ending in . ? or !`);
    if (!usesWord(r.example_sentence, r.word)) errors.push(`${at}: example does not use the word`);
    if (seen.has(w)) errors.push(`${at}: appears twice in this batch`);
    seen.add(w);
    const dup = dbWords.get(w);
    if (dup) errors.push(`${at}: already in the database (level ${dup.difficulty_level})`);
    const relatives = [
      ...(dbFamilies.get(familyKey(r.word)) ?? []),
      ...existing.filter(e => sameFamily(e.word, r.word)).map(e => e.word),
    ].filter(x => x.toLowerCase() !== w);
    const phraseRelatives = existing.filter(e => e.word.includes(' ') && e.word.toLowerCase().split(' ').includes(w)).map(e => e.word);
    const all = [...new Set([...relatives, ...phraseRelatives])];
    if (all.length && !allowFamily.has(w)) family.push(`${at}: same family as existing ${all.join(', ')}`);
  });

  const now = activeAfter;
  const adding = levelCounts(rows);
  [1, 2, 3, 4, 5].forEach((l, i) => {
    if (now[i] + adding[i] > LEVEL_TARGET) errors.push(`level ${l}: ${now[i]} + ${adding[i]} would pass the target of ${LEVEL_TARGET}`);
  });
  return { errors, family, rows };
}

