/**
 * Moves vocabulary words between difficulty levels in strict 1-to-1 swaps,
 * so every level keeps exactly the same number of words (350).
 *
 * Usage:
 *   npx tsx --env-file=.env.local scripts/swap-vocab-levels.ts            # dry run (default)
 *   npx tsx --env-file=.env.local scripts/swap-vocab-levels.ts --apply    # write
 *
 * Input: scripts/data/vocab-level-swaps.json — a list of pairs
 *   { a: { word, from, to, why }, b: { word, from, to, why } }
 * where a.from === b.to and a.to === b.from (a true swap).
 *
 * Checks (any failure stops the run; nothing is written):
 *   - every pair is a mirror swap, and every level is 1–5
 *   - no word appears in more than one pair
 *   - every word exists and is still at its "from" level
 *   - level counts after the swaps equal the counts before
 *
 * --apply writes backups/vocab-levels-<ts>.json (id, word, old level),
 * updates only difficulty_level (one statement per target level), then
 * re-reads to verify every word and every level count.
 */
import { createClient } from '@supabase/supabase-js';
import { mkdirSync, readFileSync, writeFileSync } from 'fs';
import { join } from 'path';

const APPLY = process.argv.includes('--apply');
const PAGE = 1000;

type Side = { word: string; from: number; to: number; why: string };
type Pair = { a: Side; b: Side };
type Row = { id: string; word: string; difficulty_level: number };

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) throw new Error('NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required');
const supabase = createClient(url, key, { auth: { persistSession: false } });

async function fetchAll(): Promise<Row[]> {
  const rows: Row[] = [];
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await supabase.from('vocabulary').select('id, word, difficulty_level').order('id').range(from, from + PAGE - 1);
    if (error) throw error;
    rows.push(...(data as Row[]));
    if (data.length < PAGE) return rows;
  }
}

const counts = (rows: { difficulty_level: number }[]) => [1, 2, 3, 4, 5].map(l => rows.filter(r => r.difficulty_level === l).length);

async function main() {
  const pairs = JSON.parse(readFileSync(join(process.cwd(), 'scripts', 'data', 'vocab-level-swaps.json'), 'utf8')) as Pair[];
  const rows = await fetchAll();
  const byWord = new Map(rows.map(r => [r.word, r]));
  const errors: string[] = [];
  const seen = new Set<string>();

  for (const [i, { a, b }] of pairs.entries()) {
    const at = `pair ${i + 1} (${a.word} ↔ ${b.word})`;
    if (a.from !== b.to || a.to !== b.from) errors.push(`${at}: not a mirror swap`);
    if (a.from === a.to) errors.push(`${at}: moves nothing`);
    for (const s of [a, b]) {
      if (![s.from, s.to].every(l => Number.isInteger(l) && l >= 1 && l <= 5)) errors.push(`${at}: level out of range`);
      if (seen.has(s.word)) errors.push(`${at}: "${s.word}" appears in more than one pair`);
      seen.add(s.word);
      const row = byWord.get(s.word);
      if (!row) errors.push(`${at}: "${s.word}" not in the database`);
      else if (row.difficulty_level !== s.from) errors.push(`${at}: "${s.word}" is at level ${row.difficulty_level}, not ${s.from}`);
    }
  }

  const moves = pairs.flatMap(({ a, b }) => [a, b]).map(s => ({ ...s, id: byWord.get(s.word)?.id }));
  const before = counts(rows);
  const simulated = rows.map(r => ({ difficulty_level: moves.find(m => m.id === r.id)?.to ?? r.difficulty_level }));
  const after = counts(simulated);
  if (before.join() !== after.join()) errors.push(`level counts would change: ${before.join('/')} → ${after.join('/')}`);

  console.log(`pairs: ${pairs.length} · words moving: ${moves.length}`);
  console.log(`levels before: ${before.join(' / ')} · after: ${after.join(' / ')}`);
  const flows = new Map<string, number>();
  for (const m of moves) flows.set(`${m.from}→${m.to}`, (flows.get(`${m.from}→${m.to}`) ?? 0) + 1);
  console.log('moves:', Object.fromEntries([...flows].sort()));
  console.log(`errors: ${errors.length}`);
  errors.forEach(e => console.log('  ✗', e));

  if (!APPLY) { console.log('\nDry run. Nothing written.'); return; }
  if (errors.length) throw new Error('Refusing to apply while there are errors.');

  const dir = join(process.cwd(), 'backups');
  mkdirSync(dir, { recursive: true });
  const file = join(dir, `vocab-levels-${new Date().toISOString().replace(/[:.]/g, '-')}.json`);
  writeFileSync(file, JSON.stringify(moves.map(m => ({ id: m.id, word: m.word, difficulty_level: m.from })), null, 2));
  console.log(`backup written: ${file}`);

  for (const level of [1, 2, 3, 4, 5]) {
    const ids = moves.filter(m => m.to === level).map(m => m.id!);
    if (!ids.length) continue;
    const { error } = await supabase.from('vocabulary').update({ difficulty_level: level }).in('id', ids);
    if (error) throw new Error(`update to level ${level} failed: ${error.message} (restore from ${file})`);
  }

  const reread = await fetchAll();
  const wrong = moves.filter(m => reread.find(r => r.id === m.id)?.difficulty_level !== m.to);
  const final = counts(reread);
  console.log(`verify: ${moves.length - wrong.length}/${moves.length} words at their new level · levels ${final.join(' / ')}`);
  if (wrong.length || final.join() !== before.join()) throw new Error(`Verification failed (restore from ${file})`);
}

main().catch(e => { console.error(e instanceof Error ? e.message : e); process.exit(1); });
