/**
 * Read-only export for the content audit (docs/CONTENT-AUDIT.md).
 * Writes active questions + passages to docs/audit/data/, with answer keys in a
 * SEPARATE file so judges can answer blind.
 *
 * Usage (from the main checkout, which has node_modules + .env.local):
 *   node --env-file=.env.local <worktree>/scripts/audit/export-items.mjs <worktree>/docs/audit/data
 */
import { createClient } from '@supabase/supabase-js';
import { writeFileSync, mkdirSync } from 'fs';
import { join } from 'path';

const out = process.argv[2];
if (!out) throw new Error('usage: export-items.mjs <outDir>');
mkdirSync(out, { recursive: true });

const sb = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
);

async function fetchAll(table, cols, filter) {
  let all = [];
  for (let from = 0; ; from += 1000) {
    let q = sb.from(table).select(cols).order('id').range(from, from + 999);
    if (filter) q = filter(q);
    const { data, error } = await q;
    if (error) throw new Error(`${table}: ${error.message}`);
    all = all.concat(data);
    if (data.length < 1000) break;
  }
  return all;
}

const qs = await fetchAll(
  'questions',
  'id,type,text,passage_id,options,correct_answer,difficulty_level,exam_eligible,skill,target_lemma',
  (q) => q.eq('active', true),
);
const passages = await fetchAll('passages', 'id,text,difficulty_level,active');

const items = qs.map(({ correct_answer, ...rest }) => rest);
const keys = Object.fromEntries(qs.map((q) => [q.id, q.correct_answer]));

writeFileSync(join(out, 'items.json'), JSON.stringify(items));
writeFileSync(join(out, 'keys.json'), JSON.stringify(keys));
writeFileSync(join(out, 'passages.json'), JSON.stringify(Object.fromEntries(passages.map((p) => [p.id, p]))));
console.log(`items=${items.length} passages=${passages.length}`);
