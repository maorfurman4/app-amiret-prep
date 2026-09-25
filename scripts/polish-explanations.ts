/**
 * One-off: cleans the machine-written Hebrew in questions.explanation (JSON:
 * correct_reason / options_analysis / strategy) and questions.hint, using the
 * deterministic rules in src/lib/hebrew-polish.ts.
 *
 * Usage:
 *   npx tsx --env-file=.env.local scripts/polish-explanations.ts            # dry run (default)
 *   npx tsx --env-file=.env.local scripts/polish-explanations.ts --apply    # write
 *
 * Dry run: reads everything, reports how many rows would change, checks that
 * every rewrite is idempotent and keeps four options, prints samples. Writes
 * nothing.
 *
 * --apply: first writes backups/explanations-<timestamp>.json with the
 * ORIGINAL explanation + hint of every row it is about to change (restore =
 * update each id back from that file), then updates only the changed rows,
 * touching only the explanation and hint columns.
 */
import { createClient } from '@supabase/supabase-js';
import { mkdirSync, writeFileSync } from 'fs';
import { join } from 'path';
import { polishExplanationJson, polishHebrew } from '../src/lib/hebrew-polish';

const APPLY = process.argv.includes('--apply');
const CONCURRENCY = 16;
const PAGE = 1000;

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) throw new Error('NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required');
const supabase = createClient(url, key, { auth: { persistSession: false } });

type Row = { id: string; explanation: string | null; hint: string | null };
type Change = { id: string; before: Pick<Row, 'explanation' | 'hint'>; after: Pick<Row, 'explanation' | 'hint'> };

async function fetchAll(): Promise<Row[]> {
  const rows: Row[] = [];
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await supabase
      .from('questions').select('id, explanation, hint').order('id').range(from, from + PAGE - 1);
    if (error) throw new Error(error.message);
    rows.push(...((data ?? []) as Row[]));
    if (!data || data.length < PAGE) return rows;
  }
}

function plan(rows: Row[]): { changes: Change[]; problems: string[] } {
  const changes: Change[] = [];
  const problems: string[] = [];
  for (const r of rows) {
    let explanation = r.explanation;
    if (r.explanation) {
      const next = polishExplanationJson(r.explanation);
      if (next === null) problems.push(`${r.id}: explanation is not the expected JSON — skipped`);
      else {
        const parsed = JSON.parse(next) as { options_analysis: unknown[] };
        const before = JSON.parse(r.explanation) as { options_analysis: unknown[] };
        if (parsed.options_analysis.length !== before.options_analysis.length) problems.push(`${r.id}: option count changed`);
        if (polishExplanationJson(next) !== next) problems.push(`${r.id}: explanation not idempotent`);
        explanation = next;
      }
    }
    const hint = r.hint ? polishHebrew(r.hint) : r.hint;
    if (hint && polishHebrew(hint) !== hint) problems.push(`${r.id}: hint not idempotent`);
    // Compare parsed values, not strings: re-serializing alone must not count as a change.
    const explChanged = explanation !== r.explanation
      && JSON.stringify(JSON.parse(explanation!)) !== JSON.stringify(JSON.parse(r.explanation!));
    if (explChanged || hint !== r.hint) {
      changes.push({
        id: r.id,
        before: { explanation: r.explanation, hint: r.hint },
        after: { explanation: explChanged ? explanation : r.explanation, hint },
      });
    }
  }
  return { changes, problems };
}

function dashes(s: string | null): number {
  return (s?.match(/—/g) ?? []).length;
}

async function main() {
  const rows = await fetchAll();
  const { changes, problems } = plan(rows);
  const before = changes.reduce((n, c) => n + dashes(c.before.explanation) + dashes(c.before.hint), 0);
  const after = changes.reduce((n, c) => n + dashes(c.after.explanation) + dashes(c.after.hint), 0);

  console.log(`rows: ${rows.length}`);
  console.log(`rows to change: ${changes.length}`);
  console.log(`long dashes in those rows: ${before} → ${after} (the rest are inside English quotes)`);
  console.log(`problems: ${problems.length}`);
  problems.slice(0, 20).forEach(p => console.log(`  ${p}`));

  if (!APPLY) {
    const outDir = process.env.POLISH_REPORT_DIR;
    if (outDir) writeFileSync(join(outDir, 'polish-dry-run.json'), JSON.stringify(changes, null, 2));
    console.log('\ndry run — nothing written. Re-run with --apply to update the database.');
    return;
  }
  if (problems.length > 0) throw new Error('refusing to apply while there are problems');

  mkdirSync('backups', { recursive: true });
  const backupPath = join('backups', `explanations-${new Date().toISOString().replace(/[:.]/g, '-')}.json`);
  writeFileSync(backupPath, JSON.stringify(changes.map(c => ({ id: c.id, ...c.before }))));
  console.log(`backup written: ${backupPath}`);

  let done = 0;
  const failed: string[] = [];
  for (let i = 0; i < changes.length; i += CONCURRENCY) {
    await Promise.all(changes.slice(i, i + CONCURRENCY).map(async c => {
      const { error } = await supabase.from('questions').update(c.after).eq('id', c.id);
      if (error) failed.push(`${c.id}: ${error.message}`);
      else done++;
    }));
  }
  console.log(`updated: ${done}, failed: ${failed.length}`);
  failed.slice(0, 20).forEach(f => console.log(`  ${f}`));
  if (failed.length > 0) process.exitCode = 1;
}

main().catch(e => { console.error(e); process.exit(1); });
