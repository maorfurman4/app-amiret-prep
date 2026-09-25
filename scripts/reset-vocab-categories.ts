/**
 * One-off: resets vocabulary.category so it holds only the theme, now that
 * the part of speech has its own column (part_of_speech). Each word becomes
 * "academic" or "general" from the reviewed mapping in
 * scripts/data/vocab-category.json:
 *
 *   academic — a member of an Academic Word List family (Coxhead, 2000), or
 *              a subject term from the sciences, social sciences and
 *              research methods (atom, correlation, discourse, …)
 *   general  — everything else
 *
 * The old values ("verbs", "nouns", "connectors", "advanced", …) are
 * replaced; they live on in part_of_speech and difficulty_level.
 *
 * Usage:
 *   npx tsx --env-file=.env.local scripts/reset-vocab-categories.ts            # dry run (default)
 *   npx tsx --env-file=.env.local scripts/reset-vocab-categories.ts --apply    # write
 *
 * --apply refuses on any mismatch, writes backups/vocab-category-<ts>.json
 * with every changed row's old category first, updates only the category
 * column (one query per value), then re-reads to verify.
 */
import { createClient } from '@supabase/supabase-js';
import { mkdirSync, readFileSync, writeFileSync } from 'fs';
import { join } from 'path';

const APPLY = process.argv.includes('--apply');
const PAGE = 1000;
const CHUNK = 150;
const PARTS = ['academic', 'general'] as const;
type Part = (typeof PARTS)[number];

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) throw new Error('NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required');
const supabase = createClient(url, key, { auth: { persistSession: false } });

type Row = { id: string; word: string; category: string | null };

async function fetchAll(): Promise<Row[]> {
  const rows: Row[] = [];
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await supabase
      .from('vocabulary').select('id, word, category').order('id').range(from, from + PAGE - 1);
    if (error) throw error;
    rows.push(...(data as Row[]));
    if (data.length < PAGE) return rows;
  }
}

async function main() {
  const mapping = JSON.parse(readFileSync(join(process.cwd(), 'scripts', 'data', 'vocab-category.json'), 'utf8')) as Record<string, Part>;
  const rows = await fetchAll();

  const problems: string[] = [];
  for (const [word, part] of Object.entries(mapping)) {
    if (!PARTS.includes(part)) problems.push(`"${word}": unknown category "${part}"`);
  }
  const seen = new Set<string>();
  const changes: { id: string; word: string; before: string | null; after: Part }[] = [];
  for (const r of rows) {
    if (seen.has(r.word)) problems.push(`"${r.word}" appears twice in the table`);
    seen.add(r.word);
    const part = mapping[r.word];
    if (!part) { problems.push(`"${r.word}" has no mapping`); continue; }
    if (r.category !== part) changes.push({ id: r.id, word: r.word, before: r.category, after: part });
  }
  for (const word of Object.keys(mapping)) if (!seen.has(word)) problems.push(`mapping names "${word}", which is not in the table`);

  const byPart = Object.fromEntries(PARTS.map(p => [p, changes.filter(c => c.after === p).length]));
  const before = rows.reduce<Record<string, number>>((acc, r) => { const k = r.category ?? 'null'; acc[k] = (acc[k] ?? 0) + 1; return acc; }, {});
  const after = Object.values(mapping).reduce<Record<string, number>>((acc, v) => { acc[v] = (acc[v] ?? 0) + 1; return acc; }, {});
  console.log(`words: ${rows.length}`);
  console.log(`rows to change: ${changes.length}`, byPart);
  console.log('categories now:', before);
  console.log('categories after:', after);
  console.log(`problems: ${problems.length}`);
  problems.slice(0, 20).forEach(p => console.log('  -', p));
  console.log('samples:', changes.slice(0, 8).map(c => `${c.word} → ${c.after}`).join(', '));

  if (!APPLY) { console.log('\nDry run. Nothing written. Re-run with --apply to write.'); return; }
  if (problems.length) throw new Error('Refusing to apply while there are problems.');
  if (!changes.length) { console.log('Nothing to change.'); return; }

  const dir = join(process.cwd(), 'backups');
  mkdirSync(dir, { recursive: true });
  const file = join(dir, `vocab-category-${new Date().toISOString().replace(/[:.]/g, '-')}.json`);
  writeFileSync(file, JSON.stringify(changes.map(({ id, word, before }) => ({ id, word, category: before })), null, 2));
  console.log(`backup written: ${file}`);

  for (const part of PARTS) {
    const ids = changes.filter(c => c.after === part).map(c => c.id);
    if (!ids.length) continue;
    // Chunked: a few hundred UUIDs in one ?id=in.(…) overflow the request URL.
    for (let i = 0; i < ids.length; i += CHUNK) {
      const chunk = ids.slice(i, i + CHUNK);
      const { error } = await supabase.from('vocabulary').update({ category: part }).in('id', chunk);
      if (error) throw new Error(`update failed for ${part}: ${error.message} (restore from ${file})`);
    }
    console.log(`updated ${part}: ${ids.length}`);
  }

  const reread = await fetchAll();
  const wrong = reread.filter(r => r.category !== mapping[r.word]);
  console.log(`verify: ${reread.length - wrong.length}/${reread.length} rows match the mapping`);
  if (wrong.length) throw new Error(`${wrong.length} rows do not match after the update (restore from ${file})`);
}

main().catch(e => { console.error(e instanceof Error ? e.message : e); process.exit(1); });
