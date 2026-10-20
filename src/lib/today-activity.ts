import type { SupabaseClient } from '@supabase/supabase-js';
import { localDayStart } from '@/lib/date-local';

/**
 * What the student actually answered today, read from the responses log
 * (one row per answered item, every surface: exam, practice, review,
 * diagnostic). Vocabulary flashcards aren't items, so they aren't here.
 */
export interface TodayActivity {
  answered: number;
  correct: number;
  /** Summed answer time, each item capped at ITEM_TIME_CAP_MS. */
  timeMs: number;
  /** Most-answered type first. Levels are the authored difficulty_level (1-5). */
  byType: { type: string; answered: number; correct: number; minLevel: number; maxLevel: number }[];
}

export const EMPTY_TODAY: TodayActivity = { answered: 0, correct: 0, timeMs: 0, byType: [] };

/** An item left open in a background tab must not count as an hour of practice. */
const ITEM_TIME_CAP_MS = 3 * 60_000;

/** shortcut: reads at most this many rows, a few full exams' worth; raise it if days get longer. */
const ROW_LIMIT = 1000;

export interface TodayResponseRow {
  correct: boolean;
  latency_ms: number | null;
  /** PostgREST embeds the many-to-one parent as an object (or null if the item is gone). */
  questions: { type: string; difficulty_level: number } | { type: string; difficulty_level: number }[] | null;
}

export function summarizeToday(rows: TodayResponseRow[]): TodayActivity {
  const types = new Map<string, TodayActivity['byType'][number]>();
  let correct = 0;
  let timeMs = 0;
  for (const row of rows) {
    if (row.correct) correct++;
    timeMs += Math.min(Math.max(row.latency_ms ?? 0, 0), ITEM_TIME_CAP_MS);
    const q = Array.isArray(row.questions) ? row.questions[0] : row.questions;
    if (!q) continue;
    const t = types.get(q.type) ?? { type: q.type, answered: 0, correct: 0, minLevel: q.difficulty_level, maxLevel: q.difficulty_level };
    t.answered++;
    if (row.correct) t.correct++;
    t.minLevel = Math.min(t.minLevel, q.difficulty_level);
    t.maxLevel = Math.max(t.maxLevel, q.difficulty_level);
    types.set(q.type, t);
  }
  return {
    answered: rows.length,
    correct,
    timeMs,
    byType: [...types.values()].sort((a, b) => b.answered - a.answered),
  };
}

export async function fetchTodayActivity(
  supabase: SupabaseClient,
  owner: { id: string; type: 'user' | 'guest' },
  now: Date = new Date(),
): Promise<TodayActivity> {
  const { data, error } = await supabase
    .from('responses')
    .select('correct, latency_ms, questions(type, difficulty_level)')
    .eq('owner_type', owner.type)
    .eq('owner_id', owner.id)
    // Presented-but-blank exam items aren't answers.
    .not('chosen_option', 'is', null)
    .gte('created_at', localDayStart(now).toISOString())
    .limit(ROW_LIMIT);
  // The home card is a summary, not a record: a failed read shows the empty day.
  if (error || !data) return EMPTY_TODAY;
  return summarizeToday(data as TodayResponseRow[]);
}
