/**
 * Exports the site's authored content (questions, passages, vocabulary) to a
 * timestamped JSON file under backups/. This is the only copy of ~1000
 * hand-calibrated questions and 1400+ vocabulary words outside Supabase's
 * free-tier database, which has no point-in-time recovery.
 *
 * Usage:
 *   npx tsx scripts/backup-content.ts
 *
 * Restore: read the JSON and upsert each table by id — left as a manual
 * step since a restore should never run unattended.
 */
import { createClient } from '@supabase/supabase-js';
import { writeFileSync, mkdirSync } from 'fs';
import { join } from 'path';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
);

async function fetchAll(table: string) {
  const PAGE = 1000;
  let all: unknown[] = [];
  let from = 0;
  for (;;) {
    const { data, error } = await supabase.from(table).select('*').order('id').range(from, from + PAGE - 1);
    if (error) throw new Error(`${table}: ${error.message}`);
    all = all.concat(data ?? []);
    if (!data || data.length < PAGE) break;
    from += PAGE;
  }
  return all;
}

async function main() {
  const [questions, passages, vocabulary] = await Promise.all([
    fetchAll('questions'),
    fetchAll('passages'),
    fetchAll('vocabulary'),
  ]);

  const dir = join(process.cwd(), 'backups');
  mkdirSync(dir, { recursive: true });
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const file = join(dir, `content-${stamp}.json`);

  writeFileSync(file, JSON.stringify({ exportedAt: new Date().toISOString(), questions, passages, vocabulary }, null, 2));
  console.log(`Backed up ${questions.length} questions, ${passages.length} passages, ${vocabulary.length} vocabulary words -> ${file}`);
}

main().catch(err => { console.error(err); process.exit(1); });
