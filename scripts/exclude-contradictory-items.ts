/**
 * Excludes from the adaptive exam (questions.exam_eligible = false) every
 * active question whose authored level label contradicts its authored
 * difficulty: |b − (level − 3)| > 0.75, i.e. b sits past the midpoint into a
 * neighboring level's band. Neither value has been measured, so neither is
 * "fixed"; the item simply stops being used to measure ability. Practice,
 * which uses only the label, is unaffected. Reversible: set it back to true.
 *
 * Usage:
 *   npx tsx --env-file=.env.local scripts/exclude-contradictory-items.ts            # dry run (default)
 *   npx tsx --env-file=.env.local scripts/exclude-contradictory-items.ts --apply    # write
 *
 * --apply writes backups/exam-eligible-<ts>.json (ids and previous value)
 * first, updates only exam_eligible, then re-reads to verify.
 */
import { createClient } from '@supabase/supabase-js';
import { mkdirSync, writeFileSync } from 'fs';
import { join } from 'path';

const APPLY = process.argv.includes('--apply');
const PAGE = 1000;
const CHUNK = 150;
const BAND = 0.75;

type Row = { id: string; type: string; difficulty_level: number; b: number; b_calibrated: number | null; exam_eligible: boolean; passage_id: string | null };

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) throw new Error('NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required');
const supabase = createClient(url, key, { auth: { persistSession: false } });

async function fetchActive(): Promise<Row[]> {
  const rows: Row[] = [];
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await supabase
      .from('questions').select('id, type, difficulty_level, b, b_calibrated, exam_eligible, passage_id')
      .eq('active', true).order('id').range(from, from + PAGE - 1);
    if (error) throw error;
    rows.push(...(data as Row[]));
    if (data.length < PAGE) return rows;
  }
}

const effectiveB = (r: Row) => (Number.isFinite(r.b_calibrated) ? (r.b_calibrated as number) : r.b);
const contradicts = (r: Row) => Math.abs(effectiveB(r) - (r.difficulty_level - 3)) > BAND;

async function main() {
  const rows = await fetchActive();
  const targets = rows.filter(r => contradicts(r) && r.exam_eligible);
  const already = rows.filter(r => contradicts(r) && !r.exam_eligible).length;

  const groups = new Map<string, { total: number; excluded: number }>();
  for (const r of rows) {
    const k = `${r.type} L${r.difficulty_level}`;
    const g = groups.get(k) ?? { total: 0, excluded: 0 };
    g.total++;
    if (contradicts(r)) g.excluded++;
    groups.set(k, g);
  }
  console.log(`active questions: ${rows.length} · to exclude now: ${targets.length} · already excluded: ${already}`);
  console.table([...groups].filter(([, g]) => g.excluded > 0).map(([k, g]) => ({ group: k, total: g.total, excluded: g.excluded, remainInExam: g.total - g.excluded })));
  const passageItems = targets.filter(r => r.passage_id).length;
  if (passageItems) console.log(`note: ${passageItems} of them belong to reading passages`);
  const eligibleAfter = rows.filter(r => r.exam_eligible).length - targets.length;
  console.log(`exam pool after: ${eligibleAfter} of ${rows.length}`);

  if (!APPLY) { console.log('\nDry run. Nothing written. Re-run with --apply to write.'); return; }
  if (!targets.length) { console.log('Nothing to change.'); return; }

  const dir = join(process.cwd(), 'backups');
  mkdirSync(dir, { recursive: true });
  const file = join(dir, `exam-eligible-${new Date().toISOString().replace(/[:.]/g, '-')}.json`);
  writeFileSync(file, JSON.stringify(targets.map(r => ({ id: r.id, type: r.type, difficulty_level: r.difficulty_level, b: effectiveB(r), exam_eligible: true })), null, 2));
  console.log(`backup written: ${file}`);

  const ids = targets.map(r => r.id);
  for (let i = 0; i < ids.length; i += CHUNK) {
    const { error } = await supabase.from('questions').update({ exam_eligible: false }).in('id', ids.slice(i, i + CHUNK));
    if (error) throw new Error(`update failed: ${error.message} (restore from ${file})`);
  }

  const after = await fetchActive();
  const wrong = after.filter(r => contradicts(r) === r.exam_eligible);
  console.log(`verify: ${after.filter(r => !r.exam_eligible).length} excluded, ${wrong.length} rows out of place`);
  if (wrong.length) throw new Error(`Verification failed (restore from ${file})`);
}

main().catch(e => { console.error(e instanceof Error ? e.message : e); process.exit(1); });
