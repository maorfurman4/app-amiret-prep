/**
 * One-off: fills vocabulary.part_of_speech from the reviewed mapping in
 * scripts/data/vocab-part-of-speech.json (word → part of speech, all 1,158
 * words). Run after migration 20260925120000_vocab_part_of_speech.sql.
 *
 * Usage:
 *   npx tsx --env-file=.env.local scripts/backfill-part-of-speech.ts            # dry run (default)
 *   npx tsx --env-file=.env.local scripts/backfill-part-of-speech.ts --apply    # write
 *
 * Dry run: reads every word, checks that each one has exactly one mapping
 * and that every mapping names a real word, and reports what would change.
 * Writes nothing.
 *
 * --apply: refuses to run if the dry-run checks fail. Otherwise first writes
 * backups/part-of-speech-<timestamp>.json with each changed row's current
 * value (restore = set each id back from that file), then updates only the
 * part_of_speech column, one query per part of speech, and finally re-reads
 * the table to confirm every word matches the mapping.
 */
import { createClient } from '@supabase/supabase-js';
import { mkdirSync, readFileSync, writeFileSync } from 'fs';
import { join } from 'path';

const APPLY = process.argv.includes('--apply');
const PAGE = 1000;
const CHUNK = 150;
const PARTS = ['noun', 'verb', 'adjective', 'adverb', 'connector'] as const;
type Part = (typeof PARTS)[number];

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) throw new Error('NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required');
const supabase = createClient(url, key, { auth: { persistSession: false } });

type Row = { id: string; word: string; category: string | null; part_of_speech: string | null };

async function fetchAll(): Promise<Row[]> {
  const rows: Row[] = [];
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await supabase
      .from('vocabulary').select('id, word, category, part_of_speech').order('id').range(from, from + PAGE - 1);
    if (error) {
      if (/part_of_speech/.test(error.message)) throw new Error('Column part_of_speech is missing: apply migration 20260925120000_vocab_part_of_speech.sql first.');
      throw error;
    }
    rows.push(...(data as Row[]));
    if (data.length < PAGE) return rows;
  }
}

async function main() {
  const mapping = JSON.parse(readFileSync(join(process.cwd(), 'scripts', 'data', 'vocab-part-of-speech.json'), 'utf8')) as Record<string, Part>;
  const rows = await fetchAll();

  const problems: string[] = [];
  for (const [word, part] of Object.entries(mapping)) {
    if (!PARTS.includes(part)) problems.push(`"${word}": unknown part of speech "${part}"`);
  }
  const seen = new Set<string>();
  const changes: { id: string; word: string; before: string | null; after: Part }[] = [];
  for (const r of rows) {
    if (seen.has(r.word)) problems.push(`"${r.word}" appears twice in the table`);
    seen.add(r.word);
    const part = mapping[r.word];
    if (!part) { problems.push(`"${r.word}" has no mapping`); continue; }
    if (r.part_of_speech !== part) changes.push({ id: r.id, word: r.word, before: r.part_of_speech, after: part });
  }
  for (const word of Object.keys(mapping)) if (!seen.has(word)) problems.push(`mapping names "${word}", which is not in the table`);

  const byPart = Object.fromEntries(PARTS.map(p => [p, changes.filter(c => c.after === p).length]));
  const themed = rows.filter(r => r.category === 'academic' || r.category === 'advanced').length;
  console.log(`words: ${rows.length}`);
  console.log(`rows to change: ${changes.length}`, byPart);
  console.log(`academic/advanced words gaining a part of speech: ${themed}`);
  console.log(`problems: ${problems.length}`);
  problems.slice(0, 20).forEach(p => console.log('  -', p));
  console.log('samples:', changes.slice(0, 8).map(c => `${c.word} → ${c.after}`).join(', '));

  if (!APPLY) { console.log('\nDry run. Nothing written. Re-run with --apply to write.'); return; }
  if (problems.length) throw new Error('Refusing to apply while there are problems.');
  if (!changes.length) { console.log('Nothing to change.'); return; }

  const dir = join(process.cwd(), 'backups');
  mkdirSync(dir, { recursive: true });
  const file = join(dir, `part-of-speech-${new Date().toISOString().replace(/[:.]/g, '-')}.json`);
  writeFileSync(file, JSON.stringify(changes.map(({ id, word, before }) => ({ id, word, part_of_speech: before })), null, 2));
  console.log(`backup written: ${file}`);

  for (const part of PARTS) {
    const ids = changes.filter(c => c.after === part).map(c => c.id);
    if (!ids.length) continue;
    // Chunked: a few hundred UUIDs in one ?id=in.(…) overflow the request URL.
    for (let i = 0; i < ids.length; i += CHUNK) {
      const chunk = ids.slice(i, i + CHUNK);
      const { error } = await supabase.from('vocabulary').update({ part_of_speech: part }).in('id', chunk);
      if (error) throw new Error(`update failed for ${part}: ${error.message} (restore from ${file})`);
    }
    console.log(`updated ${part}: ${ids.length}`);
  }

  const after = await fetchAll();
  const wrong = after.filter(r => r.part_of_speech !== mapping[r.word]);
  console.log(`verify: ${after.length - wrong.length}/${after.length} rows match the mapping`);
  if (wrong.length) throw new Error(`${wrong.length} rows do not match after the update (restore from ${file})`);
}

main().catch(e => { console.error(e instanceof Error ? e.message : e); process.exit(1); });
