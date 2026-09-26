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
import { fetchAllWords, isActive, levelCounts, validateNewWords, LEVEL_TARGET } from './lib/vocab-rules';

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
  const existing = await fetchAllWords(supabase);
  const active = existing.filter(isActive);
  const { errors, family, rows } = validateNewWords(batch, existing, allowFamily, levelCounts(active));

  const levels = [1, 2, 3, 4, 5].map(l => {
    const now = active.filter(e => e.difficulty_level === l).length;
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

  const after = await fetchAllWords(supabase);
  const ok = after.length === existing.length + rows.length && rows.every(r => after.some(a => a.word === r.word));
  console.log(`verify: ${after.length} words now (was ${existing.length}) ${ok ? '✓' : '✗ MISMATCH'}`);
  if (!ok) throw new Error('Verification failed. Undo with --rollback ' + log);
}

main().catch(e => { console.error(e instanceof Error ? e.message : e); process.exit(1); });
