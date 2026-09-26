/**
 * Archives words that do not belong in their level and inserts the same
 * number of replacements per level, as ONE atomic database statement.
 *
 * Usage:
 *   npx tsx --env-file=.env.local scripts/archive-replace-vocab.ts [file] [--allow-family=w1,w2]
 *
 * Input (default scripts/data/vocab-archive-replace.json):
 *   { archive: [{ word, difficulty_level, why }], add: [new words, same fields as insert-vocab-batch],
 *     pos_fixes?: [{ word, from, to, why }] }   — part-of-speech corrections in the same statement
 *
 * Read-only. Checks everything, then writes two SQL files to supabase/data-ops/:
 *   <name>.sql         — the operation: one DO block (all or nothing) that
 *                        archives exactly the listed words at their listed
 *                        level, inserts exactly the new words, and raises an
 *                        error (rolling everything back) unless every level
 *                        ends with exactly 350 active words
 *   <name>.revert.sql  — the way back: un-archives the words and removes the
 *                        inserted ones, also as one all-or-nothing block
 *
 * Checks (any error: no SQL is written):
 *   - archive: each word exists, is active, is at the listed level, is a
 *     general word and not a connector (the agreed scope), appears once
 *   - add: the same rules as every batch insert (scripts/lib/vocab-rules.ts),
 *     duplicates and families against every word, archived ones included
 *   - per level: archived count = added count, and 350 active afterwards
 */
import { createClient } from '@supabase/supabase-js';
import { mkdirSync, readFileSync, writeFileSync } from 'fs';
import { basename, join } from 'path';
import { fetchAllWords, isActive, levelCounts, validateNewWords, LEVEL_TARGET, type NewWord } from './lib/vocab-rules';

type ArchiveItem = { word: string; difficulty_level: number; why: string };
type PosFix = { word: string; from: string; to: string; why: string };

const args = process.argv.slice(2);
const file = args.find(a => !a.startsWith('--')) ?? join(process.cwd(), 'scripts', 'data', 'vocab-archive-replace.json');
const allowFamily = new Set((args.find(a => a.startsWith('--allow-family=')) ?? '').replace('--allow-family=', '').split(',').filter(Boolean));

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) throw new Error('NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required');
const supabase = createClient(url, key, { auth: { persistSession: false } });

const lit = (s: string) => `'${s.replace(/'/g, "''")}'`;

async function main() {
  const { archive, add, pos_fixes: posFixes = [] } = JSON.parse(readFileSync(file, 'utf8')) as { archive: ArchiveItem[]; add: unknown[]; pos_fixes?: PosFix[] };
  const all = await fetchAllWords(supabase);
  const hasColumn = all.some(w => w.is_archived !== undefined);
  const active = all.filter(isActive);
  const byWord = new Map(all.map(w => [w.word, w]));
  const errors: string[] = [];

  const seen = new Set<string>();
  for (const a of archive) {
    const w = byWord.get(a.word);
    if (seen.has(a.word)) errors.push(`archive "${a.word}": listed twice`);
    seen.add(a.word);
    if (!w) { errors.push(`archive "${a.word}": not in the database`); continue; }
    if (w.is_archived) errors.push(`archive "${a.word}": already archived`);
    if (w.difficulty_level !== a.difficulty_level) errors.push(`archive "${a.word}": is at level ${w.difficulty_level}, not ${a.difficulty_level}`);
    if (w.category !== 'general') errors.push(`archive "${a.word}": is ${w.category}, outside the agreed scope (general words only)`);
    if (w.part_of_speech === 'connector') errors.push(`archive "${a.word}": is a connector, outside the agreed scope`);
  }

  for (const f of posFixes) {
    const w = byWord.get(f.word);
    if (!w) errors.push(`pos fix "${f.word}": not in the database`);
    else if (w.part_of_speech !== f.from) errors.push(`pos fix "${f.word}": is ${w.part_of_speech}, not ${f.from}`);
    if (!['noun', 'verb', 'adjective', 'adverb', 'connector'].includes(f.to)) errors.push(`pos fix "${f.word}": ${f.to} is not a part of speech`);
  }

  const archivedPerLevel = levelCounts(archive);
  const activeNow = levelCounts(active);
  const activeAfterArchive = activeNow.map((n, i) => n - archivedPerLevel[i]);
  const { errors: addErrors, family, rows } = validateNewWords(add, all, allowFamily, activeAfterArchive);
  errors.push(...addErrors);
  const addedPerLevel = levelCounts(rows);
  const final = activeAfterArchive.map((n, i) => n + addedPerLevel[i]);
  [1, 2, 3, 4, 5].forEach((l, i) => {
    if (archivedPerLevel[i] !== addedPerLevel[i]) errors.push(`level ${l}: archives ${archivedPerLevel[i]} but adds ${addedPerLevel[i]}`);
    if (final[i] !== LEVEL_TARGET) errors.push(`level ${l}: would end with ${final[i]} active words, not ${LEVEL_TARGET}`);
  });

  console.log(`database: ${all.length} words, ${active.length} active${hasColumn ? '' : ' (is_archived column not added yet: every word counts as active)'}`);
  console.table([1, 2, 3, 4, 5].map((l, i) => ({ level: l, activeNow: activeNow[i], archive: archivedPerLevel[i], add: addedPerLevel[i], activeAfter: final[i] })));
  if (posFixes.length) console.log(`part-of-speech fixes: ${posFixes.map(f => `${f.word} ${f.from} → ${f.to}`).join(', ')}`);
  console.log(`errors: ${errors.length}`);
  errors.forEach(e => console.log('  ✗', e));
  console.log(`family warnings: ${family.length}${family.length ? ' (acknowledge with --allow-family=… after review)' : ''}`);
  family.forEach(f => console.log('  !', f));
  if (errors.length || family.length) { console.log('\nNo SQL written.'); process.exitCode = 1; return; }

  const archiveValues = archive.map(a => `(${lit(a.word)}, ${a.difficulty_level})`).join(',\n      ');
  const insertValues = (rows as NewWord[]).map(r =>
    `(${[r.word, r.hebrew_translation, r.definition, r.example_sentence, r.part_of_speech, r.category].map(lit).join(', ')}, ${r.difficulty_level})`,
  ).join(',\n      ');
  const levelCheck = `
  -- Every level must end with exactly ${LEVEL_TARGET} active words.
  if (select count(*) from (select difficulty_level from public.vocabulary where not is_archived group by difficulty_level having count(*) = ${LEVEL_TARGET}) ok) <> 5 then
    raise exception 'level counts are not ${LEVEL_TARGET} each: %', (select string_agg(difficulty_level || '=' || c, ' ' order by difficulty_level) from (select difficulty_level, count(*) c from public.vocabulary where not is_archived group by 1) t);
  end if;`;

  const name = basename(file).replace(/\.json$/, '');
  const dir = join(process.cwd(), 'supabase', 'data-ops');
  mkdirSync(dir, { recursive: true });

  const op = `-- Generated by scripts/archive-replace-vocab.ts from ${basename(file)}.
-- One statement: archives ${archive.length}, inserts ${rows.length}, checks ${LEVEL_TARGET} per level.
-- Any failed check raises an error and Postgres rolls back all of it.
do $$
declare n int;
begin
  update public.vocabulary v set is_archived = true
  from (values
      ${archiveValues}
  ) a(word, lvl)
  where v.word = a.word and v.difficulty_level = a.lvl and not v.is_archived;
  get diagnostics n = row_count;
  if n <> ${archive.length} then raise exception 'archived % words, expected ${archive.length}', n; end if;

  insert into public.vocabulary (word, hebrew_translation, definition, example_sentence, part_of_speech, category, difficulty_level)
  values
      ${insertValues};
  get diagnostics n = row_count;
  if n <> ${rows.length} then raise exception 'inserted % words, expected ${rows.length}', n; end if;
${posFixes.map(f => `
  update public.vocabulary set part_of_speech = ${lit(f.to)} where word = ${lit(f.word)} and part_of_speech = ${lit(f.from)};
  get diagnostics n = row_count;
  if n <> 1 then raise exception 'part of speech fix for ${f.word.replace(/'/g, "''")} matched % rows, expected 1', n; end if;`).join('')}
${levelCheck}
end $$;
`;
  const revert = `-- Reverts ${name}.sql: un-archives the ${archive.length} words and removes the ${rows.length} inserted ones.
-- One statement, all or nothing. Deleting an inserted word also deletes any user known/favorite rows on it.
do $$
declare n int;
begin
  update public.vocabulary set is_archived = false
  where word in (${archive.map(a => lit(a.word)).join(', ')}) and is_archived;
  get diagnostics n = row_count;
  if n <> ${archive.length} then raise exception 'un-archived % words, expected ${archive.length}', n; end if;

  delete from public.vocabulary where word in (${rows.map(r => lit(r.word)).join(', ')});
  get diagnostics n = row_count;
  if n <> ${rows.length} then raise exception 'removed % words, expected ${rows.length}', n; end if;
${posFixes.map(f => `
  update public.vocabulary set part_of_speech = ${lit(f.from)} where word = ${lit(f.word)} and part_of_speech = ${lit(f.to)};`).join('')}
${levelCheck}
end $$;
`;
  writeFileSync(join(dir, `${name}.sql`), op);
  writeFileSync(join(dir, `${name}.revert.sql`), revert);
  console.log(`\nSQL written (nothing executed): supabase/data-ops/${name}.sql and ${name}.revert.sql`);
}

main().catch(e => { console.error(e instanceof Error ? e.message : e); process.exit(1); });
