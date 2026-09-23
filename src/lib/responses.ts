import type { SupabaseClient } from '@supabase/supabase-js';
import { isCorrectAnswer, type Question } from '@/types/exam';

/**
 * Server-side writers for public.responses — the per-item answer log every
 * question-serving surface feeds (see the table's migration for the column
 * semantics). Correctness is always graded here against the stored key,
 * never taken from the client.
 */

export type ResponseContext = 'exam' | 'practice' | 'review' | 'diagnostic';
export type OwnerType = 'user' | 'guest';

/** Row shape commit_exam_section's p_responses expects (it adds owner/session). */
export interface ExamResponseRow {
  owner_type: OwnerType;
  item_id: string;
  context: ResponseContext;
  correct: boolean;
  chosen_option: number | null;
  latency_ms: number | null;
  theta_before: number;
  section_index: number;
}

/**
 * One row per question in a submitted exam section, in the section's own
 * order. Exam options are never shuffled, so `answers` are already
 * canonical. `timingsSeconds` is the client's per-question dwell time and
 * is optional — a section with no usable timings still logs every answer,
 * just without latency.
 */
export function buildExamResponseRows({
  questions,
  answers,
  timingsSeconds,
  ownerType,
  isPractice,
  thetaBefore,
  sectionIndex,
}: {
  questions: Question[];
  answers: (number | null)[];
  timingsSeconds?: number[];
  ownerType: OwnerType;
  isPractice: boolean;
  thetaBefore: number;
  sectionIndex: number;
}): ExamResponseRow[] {
  return questions.map((question, i) => ({
    owner_type: ownerType,
    item_id: question.id,
    // An untimed practice-mode exam shows answers immediately — its
    // responses are practice data, not exam-condition data.
    context: isPractice ? 'practice' : 'exam',
    correct: isCorrectAnswer(question, answers[i] ?? null),
    chosen_option: answers[i] ?? null,
    latency_ms: timingsSeconds ? Math.round(timingsSeconds[i] * 1000) : null,
    theta_before: thetaBefore,
    section_index: sectionIndex,
  }));
}

/** A response as reported by a client surface (practice / review / diagnostic). */
export interface ClientResponseInput {
  itemId: string;
  context: Exclude<ResponseContext, 'exam'>;
  /** Canonical option index (see toCanonicalOption), null = left blank. */
  chosenOption: number | null;
  latencyMs?: number | null;
  confidence?: number | null;
  thetaBefore?: number | null;
  sectionIndex?: number | null;
}

/**
 * Grades client-reported responses against the stored answer key and
 * inserts them. Responses for item ids that don't exist are dropped (never
 * trusted, never guessed at). Returns how many rows were written.
 */
export async function recordClientResponses(
  supabase: SupabaseClient,
  owner: { id: string; type: OwnerType },
  inputs: ClientResponseInput[],
): Promise<{ recorded: number; error: string | null }> {
  if (inputs.length === 0) return { recorded: 0, error: null };

  const itemIds = [...new Set(inputs.map(r => r.itemId))];
  const { data: keys, error: keyErr } = await supabase
    .from('questions')
    .select('id, correct_answer')
    .in('id', itemIds);
  if (keyErr) return { recorded: 0, error: keyErr.message };

  const keyById = new Map((keys ?? []).map(k => [k.id as string, k.correct_answer as number]));
  const rows = inputs
    .filter(r => keyById.has(r.itemId))
    .map(r => ({
      owner_id: owner.id,
      owner_type: owner.type,
      item_id: r.itemId,
      context: r.context,
      correct: r.chosenOption !== null && r.chosenOption === keyById.get(r.itemId),
      chosen_option: r.chosenOption,
      latency_ms: r.latencyMs ?? null,
      confidence: r.confidence ?? null,
      theta_before: r.thetaBefore ?? null,
      section_index: r.sectionIndex ?? null,
    }));
  if (rows.length === 0) return { recorded: 0, error: null };

  const { error } = await supabase.from('responses').insert(rows);
  if (error) return { recorded: 0, error: error.message };
  return { recorded: rows.length, error: null };
}
