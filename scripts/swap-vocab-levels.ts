/**
 * Moves vocabulary words between difficulty levels in closed groups — 1-to-1
 * swaps or cycles (A→B, B→C, C→A) — so every level keeps exactly the same
 * number of words (350).
 *
 * Usage:
 *   npx tsx --env-file=.env.local scripts/swap-vocab-levels.ts [file]            # dry run (default)
 *   npx tsx --env-file=.env.local scripts/swap-vocab-levels.ts [file] --apply    # write
 *
 * Input (default scripts/data/vocab-level-swaps.json), either
 *   [{ a: { word, from, to, why }, b: {…} }]            — pairs
 *   { groups: [{ kind, moves: [{ word, from, to, why }] }] } — swaps and cycles
 *
 * Checks (any failure stops the run; nothing is written):
 *   - every group is closed: for each level, as many words enter as leave
 *   - every level is 1–5, and no move stays in place
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
import { fetchAllWords } from './lib/vocab-rules';

const APPLY = process.argv.includes('--apply');

type Side = { word: string; from: number; to: number; why: string };
type Pair = { a: Side; b: Side };
type Group = { kind?: string; moves: Side[] };
type Row = { id: string; word: string; difficulty_level: number; is_archived?: boolean };

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) throw new Error('NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required');
const supabase = createClient(url, key, { auth: { persistSession: false } });

const fetchAll = async (): Promise<Row[]> => (await fetchAllWords(supabase)) as Row[];

// Active words only: archived words do not count toward the 350 per level.
const counts = (rows: { difficulty_level: number; is_archived?: boolean }[]) => [1, 2, 3, 4, 5].map(l => rows.filter(r => r.difficulty_level === l && !r.is_archived).length);

async function main() {
  const fileArg = process.argv.slice(2).find(a => !a.startsWith('--'));
  const raw = JSON.parse(readFileSync(fileArg ?? join(process.cwd(), 'scripts', 'data', 'vocab-level-swaps.json'), 'utf8')) as Pair[] | { groups: Group[] };
  const groups: Group[] = Array.isArray(raw) ? raw.map(p => ({ kind: 'swap', moves: [p.a, p.b] })) : raw.groups;
  const rows = await fetchAll();
  const byWord = new Map(rows.map(r => [r.word, r]));
  const errors: string[] = [];
  const seen = new Set<string>();

  for (const [i, { moves: group }] of groups.entries()) {
    const at = `group ${i + 1} (${group.map(m => m.word).join(' → ')})`;
    for (const level of [1, 2, 3, 4, 5]) {
      const out = group.filter(m => m.from === level).length;
      const inn = group.filter(m => m.to === level).length;
      if (out !== inn) errors.push(`${at}: level ${level} loses ${out} but gains ${inn} (not a closed swap/cycle)`);
    }
    for (const s of group) {
      if (s.from === s.to) errors.push(`${at}: "${s.word}" moves nothing`);
      if (![s.from, s.to].every(l => Number.isInteger(l) && l >= 1 && l <= 5)) errors.push(`${at}: level out of range`);
      if (seen.has(s.word)) errors.push(`${at}: "${s.word}" appears in more than one group`);
      seen.add(s.word);
      const row = byWord.get(s.word);
      if (!row) errors.push(`${at}: "${s.word}" not in the database`);
      else if (row.difficulty_level !== s.from) errors.push(`${at}: "${s.word}" is at level ${row.difficulty_level}, not ${s.from}`);
    }
  }

  const moves = groups.flatMap(g => g.moves).map(s => ({ ...s, id: byWord.get(s.word)?.id }));
  const before = counts(rows);
  const simulated = rows.map(r => ({ difficulty_level: moves.find(m => m.id === r.id)?.to ?? r.difficulty_level }));
  const after = counts(simulated);
  if (before.join() !== after.join()) errors.push(`level counts would change: ${before.join('/')} → ${after.join('/')}`);

  console.log(`groups: ${groups.length} (${groups.filter(g => g.moves.length === 2).length} swaps, ${groups.filter(g => g.moves.length > 2).length} cycles) · words moving: ${moves.length}`);
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
