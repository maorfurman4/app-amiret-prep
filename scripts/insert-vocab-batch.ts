/**
 * Appends a reviewed batch of NEW words to public.vocabulary. Insert only:
 * it never updates or deletes an existing word.
 *
 * Usage:
 *   npx tsx --env-file=.env.local scripts/insert-vocab-batch.ts <batch.json>                 # dry run (default)
 *   npx tsx --env-file=.env.local scripts/insert-vocab-batch.ts <batch.json> --apply         # insert
 *   npx tsx --env-file=.env.local scripts/insert-vocab-batch.ts --rollback <insert-log.json> # undo one insert
 *
 * Batch file: a JSON array of objects with exactly these fields:
 *   word, hebrew_translation, definition, example_sentence,
 *   part_of_speech (noun | verb | adjective | adverb | connector),
 *   category (academic | general), difficulty_level (1–5)
 *
 * Checks (any error stops the run; nothing is written):
 *   - shape and allowed values of every field
 *   - clean text: no trailing period on the definition, no quote marks in
 *     the example, the example actually uses the word, Hebrew translation
 *   - no duplicates inside the batch, and none against the database
 *     (case-insensitive, re-read from the database on every run)
 *   - no level pushed past its target of 350 words
 * Warning (stops the run unless acknowledged with --allow-family=w1,w2):
 *   - a word from the same family as an existing word (explain / explanation)
 *
 * --apply inserts the whole batch in one statement (all or nothing), writes
 * backups/vocab-insert-<ts>.json with the new ids, then re-reads to verify.
 * --rollback deletes exactly the ids in that log, and only rows whose word
 * still matches the log.
 */
import { createClient } from '@supabase/supabase-js';
import { mkdirSync, readFileSync, writeFileSync } from 'fs';
import { join } from 'path';

const LEVEL_TARGET = 350;
const PAGE = 1000;
const PARTS = ['noun', 'verb', 'adjective', 'adverb', 'connector'];
const CATEGORIES = ['academic', 'general'];
const FIELDS = ['word', 'hebrew_translation', 'definition', 'example_sentence', 'part_of_speech', 'category', 'difficulty_level'];
const HEBREW = /[֐-׿]/;
const QUOTES = /["“”„«»]/;

type NewWord = {
  word: string; hebrew_translation: string; definition: string; example_sentence: string;
  part_of_speech: string; category: string; difficulty_level: number;
};
type Existing = { id: string; word: string; difficulty_level: number };

const args = process.argv.slice(2);
const APPLY = args.includes('--apply');
const ROLLBACK = args.includes('--rollback');
const allowFamily = new Set((args.find(a => a.startsWith('--allow-family=')) ?? '').replace('--allow-family=', '').split(',').filter(Boolean).map(w => w.toLowerCase()));
const file = args.find(a => !a.startsWith('--'));

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) throw new Error('NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required');
if (!file) throw new Error('Pass a batch file (or --rollback <insert-log.json>)');
const supabase = createClient(url, key, { auth: { persistSession: false } });

async function fetchAll(): Promise<Existing[]> {
  const rows: Existing[] = [];
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await supabase.from('vocabulary').select('id, word, difficulty_level').order('id').range(from, from + PAGE - 1);
    if (error) throw error;
    rows.push(...(data as Existing[]));
    if (data.length < PAGE) return rows;
  }
}

/** Rough family key: strips common suffixes so explain / explanation, common / commonly meet. */
function familyKey(word: string): string {
  let w = word.toLowerCase().trim();
  for (const suf of ['ations', 'ation', 'ments', 'ment', 'nesses', 'ness', 'ities', 'ity', 'ively', 'ive', 'ally', 'ly', 'ing', 'ed', 'es', 's', 'ion', 'al', 'e', 'y']) {
    if (w.endsWith(suf) && w.length - suf.length >= 4) { w = w.slice(0, -suf.length); break; }
  }
  return w;
}

/** explain / explanation, common / commonly: a long shared start relative to the shorter word. */
function sameFamily(a: string, b: string): boolean {
  const x = a.toLowerCase(), y = b.toLowerCase();
  if (x === y || x.includes(' ') || y.includes(' ')) return false;
  let n = 0;
  while (n < x.length && n < y.length && x[n] === y[n]) n++;
  return n >= Math.max(5, Math.min(x.length, y.length) - 2);
}

function usesWord(example: string, word: string): boolean {
  const stem = familyKey(word).slice(0, Math.max(4, familyKey(word).length - 1));
  return example.toLowerCase().includes(word.toLowerCase()) || example.toLowerCase().includes(stem);
}

function validate(batch: unknown, existing: Existing[]): { errors: string[]; family: string[]; rows: NewWord[] } {
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

  const perLevel = (list: { difficulty_level: number }[]) => [1, 2, 3, 4, 5].map(l => list.filter(x => x.difficulty_level === l).length);
  const now = perLevel(existing);
  const adding = perLevel(rows);
  [1, 2, 3, 4, 5].forEach((l, i) => {
    if (now[i] + adding[i] > LEVEL_TARGET) errors.push(`level ${l}: ${now[i]} + ${adding[i]} would pass the target of ${LEVEL_TARGET}`);
  });
  return { errors, family, rows };
}

async function rollback(logFile: string) {
  const log = JSON.parse(readFileSync(logFile, 'utf8')) as { inserted: { id: string; word: string }[] };
  const ids = log.inserted.map(r => r.id);
  const { data, error } = await supabase.from('vocabulary').select('id, word').in('id', ids);
  if (error) throw error;
  const expected = new Map(log.inserted.map(r => [r.id, r.word]));
  const safe = (data ?? []).filter(r => expected.get(r.id) === r.word).map(r => r.id);
  console.log(`rollback: ${safe.length} of ${ids.length} rows still match the log`);
  if (!APPLY) { console.log('Dry run. Re-run with --apply to delete them.'); return; }
  const { error: delError } = await supabase.from('vocabulary').delete().in('id', safe);
  if (delError) throw delError;
  console.log(`deleted ${safe.length} rows`);
}

async function main() {
  if (ROLLBACK) return rollback(file!);

  const batch = JSON.parse(readFileSync(file!, 'utf8')) as unknown;
  const existing = await fetchAll();
  const { errors, family, rows } = validate(batch, existing);

  const levels = [1, 2, 3, 4, 5].map(l => {
    const now = existing.filter(e => e.difficulty_level === l).length;
    const add = rows.filter(r => r.difficulty_level === l).length;
    return { level: l, now, adding: add, after: now + add, stillMissing: Math.max(0, LEVEL_TARGET - now - add) };
  });
  console.log(`database: ${existing.length} words · batch: ${rows.length} words`);
  console.table(levels);
  console.log(`errors: ${errors.length}`);
  errors.forEach(e => console.log('  ✗', e));
  console.log(`family warnings: ${family.length}${family.length ? ' (acknowledge with --allow-family=word1,word2 after review)' : ''}`);
  family.forEach(f => console.log('  !', f));

  if (!APPLY) { console.log('\nDry run. Nothing written.'); return; }
  if (errors.length || family.length) throw new Error('Refusing to insert: fix the errors / review the family warnings first.');

  const { data, error } = await supabase.from('vocabulary').insert(rows).select('id, word');
  if (error) throw new Error(`insert failed, nothing was written: ${error.message}`);

  const dir = join(process.cwd(), 'backups');
  mkdirSync(dir, { recursive: true });
  const log = join(dir, `vocab-insert-${new Date().toISOString().replace(/[:.]/g, '-')}.json`);
  writeFileSync(log, JSON.stringify({ batch: file, inserted: data }, null, 2));
  console.log(`inserted ${data.length} words · log (for --rollback): ${log}`);

  const after = await fetchAll();
  const ok = after.length === existing.length + rows.length && rows.every(r => after.some(a => a.word === r.word));
  console.log(`verify: ${after.length} words now (was ${existing.length}) ${ok ? '✓' : '✗ MISMATCH'}`);
  if (!ok) throw new Error('Verification failed. Undo with --rollback ' + log);
}

main().catch(e => { console.error(e instanceof Error ? e.message : e); process.exit(1); });
