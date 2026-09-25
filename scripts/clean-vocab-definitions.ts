/**
 * One-off: removes the trailing period from vocabulary definitions, so the
 * stored text matches the new-word rule (no trailing period). A final "..."
 * is kept. A definition made of two sentences has them joined with a
 * semicolon first ("A. B." → "A; b"), so no sentence break is left inside.
 *
 * Usage:
 *   npx tsx --env-file=.env.local scripts/clean-vocab-definitions.ts            # dry run (default)
 *   npx tsx --env-file=.env.local scripts/clean-vocab-definitions.ts --apply    # write
 *
 * --apply writes backups/vocab-definitions-<ts>.json with each changed row's
 * original definition first, updates only the definition column, then
 * re-reads to verify that no definition ends with a single period.
 */
import { createClient } from '@supabase/supabase-js';
import { mkdirSync, writeFileSync } from 'fs';
import { join } from 'path';

const APPLY = process.argv.includes('--apply');
const PAGE = 1000;
const CONCURRENCY = 16;

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) throw new Error('NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required');
const supabase = createClient(url, key, { auth: { persistSession: false } });

type Row = { id: string; word: string; definition: string };

export function cleanDefinition(text: string): string {
  let s = text.trim();
  // "A. B." → "A; b" — one definition, no sentence break inside.
  s = s.replace(/([^.])\. ([A-Z])/g, (_m, before: string, cap: string) => `${before}; ${cap.toLowerCase()}`);
  if (/[^.]\.$/.test(s)) s = s.slice(0, -1).trimEnd();
  return s;
}

async function fetchAll(): Promise<Row[]> {
  const rows: Row[] = [];
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await supabase.from('vocabulary').select('id, word, definition').order('id').range(from, from + PAGE - 1);
    if (error) throw error;
    rows.push(...(data as Row[]));
    if (data.length < PAGE) return rows;
  }
}

async function main() {
  const rows = await fetchAll();
  const changes = rows
    .map(r => ({ id: r.id, word: r.word, before: r.definition, after: cleanDefinition(r.definition) }))
    .filter(c => c.after !== c.before);

  const problems: string[] = [];
  for (const c of changes) {
    if (!c.after) problems.push(`${c.word}: would become empty`);
    if (cleanDefinition(c.after) !== c.after) problems.push(`${c.word}: not stable on a second pass`);
    if (c.before.length - c.after.length > 2 && !/\. [A-Z]/.test(c.before)) problems.push(`${c.word}: removes more than the final period`);
  }

  console.log(`words: ${rows.length}`);
  console.log(`definitions to change: ${changes.length}`);
  console.log(`problems: ${problems.length}`);
  problems.forEach(p => console.log('  -', p));
  changes.filter(c => /\. [A-Z]/.test(c.before)).forEach(c => console.log(`  two sentences → ${c.word}: "${c.after}"`));
  changes.slice(0, 5).forEach(c => console.log(`  ${c.word}: "${c.before}" → "${c.after}"`));

  if (!APPLY) { console.log('\nDry run. Nothing written. Re-run with --apply to write.'); return; }
  if (problems.length) throw new Error('Refusing to apply while there are problems.');
  if (!changes.length) { console.log('Nothing to change.'); return; }

  const dir = join(process.cwd(), 'backups');
  mkdirSync(dir, { recursive: true });
  const file = join(dir, `vocab-definitions-${new Date().toISOString().replace(/[:.]/g, '-')}.json`);
  writeFileSync(file, JSON.stringify(changes.map(({ id, word, before }) => ({ id, word, definition: before })), null, 2));
  console.log(`backup written: ${file}`);

  let done = 0;
  const failed: string[] = [];
  for (let i = 0; i < changes.length; i += CONCURRENCY) {
    await Promise.all(changes.slice(i, i + CONCURRENCY).map(async c => {
      const { error } = await supabase.from('vocabulary').update({ definition: c.after }).eq('id', c.id);
      if (error) failed.push(`${c.word}: ${error.message}`); else done++;
    }));
  }
  console.log(`updated: ${done}, failed: ${failed.length}`);
  failed.forEach(f => console.log('  -', f));

  const after = await fetchAll();
  const left = after.filter(r => /[^.]\.$/.test(r.definition));
  console.log(`verify: ${left.length} definitions still end with a single period`);
  if (failed.length || left.length) throw new Error(`Not fully clean (restore from ${file} if needed)`);
}

main().catch(e => { console.error(e instanceof Error ? e.message : e); process.exit(1); });
