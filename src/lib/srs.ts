import type { SupabaseClient } from '@supabase/supabase-js';
import type { Question } from '@/types/exam';
import { todayLocalStr } from '@/lib/date-local';
import {
  Again, Hard, capDueToExam, examInstant, gradeResponse, initialState, reviewCard, scheduleDue,
  MS_PER_DAY, type CardState,
} from '@/lib/fsrs';

/**
 * Skill-based spaced repetition on top of FSRS (src/lib/fsrs.ts).
 *
 * The scheduling unit is a *concept* (questions.concept_key — a target word,
 * a restatement connector, a reading skill), not a question: one card per
 * owner per concept. Any answered question feeds its concept's card, and a
 * due card is reviewed through a *sibling* question testing the same
 * concept, so the student has to use the skill again rather than recognise
 * an item they have already seen. Only mistakes create cards; a correct
 * answer on a concept with no card is not something to schedule.
 */

export type OwnerType = 'user' | 'guest';
export interface SrsOwner { id: string; type: OwnerType }

export interface SrsEvent {
  itemId: string;
  /** Graded server-side against the answer key. */
  correct: boolean;
  latencyMs: number | null;
  confidence?: number | null;
  /** When the answer happened; defaults to now. */
  at?: Date;
}

interface CardRow {
  id: number;
  concept_key: string;
  stability: number;
  difficulty: number;
  reps: number;
  lapses: number;
  last_review_at: string;
  due_at: string;
  version: number;
}

interface ItemConcept {
  id: string;
  type: string;
  skill: string | null;
  target_lemma: string | null;
  concept_key: string;
}

const CARD_COLUMNS = 'id, concept_key, stability, difficulty, reps, lapses, last_review_at, due_at, version';
const MAX_CAS_ATTEMPTS = 3;

export async function getExamAt(supabase: SupabaseClient, owner: SrsOwner): Promise<Date | null> {
  // Exam dates live on the account's goals; guests have none.
  if (owner.type !== 'user') return null;
  const { data } = await supabase.from('user_goals').select('exam_date').eq('user_id', owner.id).maybeSingle();
  return examInstant((data as { exam_date?: string | null } | null)?.exam_date ?? null);
}

function toState(row: CardRow): CardState {
  return {
    stability: row.stability,
    difficulty: row.difficulty,
    reps: row.reps,
    lapses: row.lapses,
    lastReviewAt: new Date(row.last_review_at),
  };
}

export interface FoldResult {
  state: CardState | null;
  /** First event that created the card (null when the card already existed). */
  createdBy: SrsEvent | null;
  /** The card was due and this batch reviewed it successfully. */
  cleared: boolean;
}

/**
 * Replays a concept's events, in order, onto its card (or onto nothing,
 * if the owner has no card for it yet). Pure — exported for tests.
 */
export function foldEvents(existing: CardRow | null, type: string, events: SrsEvent[], now: Date): FoldResult {
  let state = existing ? toState(existing) : null;
  let createdBy: SrsEvent | null = null;
  let cleared = false;
  const wasDue = existing ? new Date(existing.due_at).getTime() <= now.getTime() : false;

  for (const event of events) {
    const at = event.at ?? now;
    const grade = gradeResponse({ correct: event.correct, latencyMs: event.latencyMs, type, confidence: event.confidence });
    if (!state) {
      if (grade !== Again) continue;
      state = initialState(Again, at);
      createdBy = event;
      continue;
    }
    // A review can never be dated before the review it follows.
    const reviewAt = at.getTime() < state.lastReviewAt.getTime() ? state.lastReviewAt : at;
    if (wasDue && !cleared && grade >= Hard) cleared = true;
    state = reviewCard(state, grade, reviewAt);
  }
  return { state, createdBy, cleared };
}

/**
 * Feeds answered questions into their concepts' FSRS cards. Every write is
 * compare-and-swap on `version`, so two concurrent submissions touching the
 * same concept can never silently overwrite each other — the loser re-reads
 * and replays its events on top of the winner's state.
 */
export async function applyResponsesToSrs(
  supabase: SupabaseClient,
  owner: SrsOwner,
  events: SrsEvent[],
  now: Date = new Date(),
): Promise<{ created: number; reviewed: number; cleared: number; error: string | null }> {
  const result = { created: 0, reviewed: 0, cleared: 0, error: null as string | null };
  if (events.length === 0) return result;

  const itemIds = [...new Set(events.map(e => e.itemId))];
  const { data: items, error: itemErr } = await supabase
    .from('questions')
    .select('id, type, skill, target_lemma, concept_key')
    .in('id', itemIds);
  if (itemErr) return { ...result, error: itemErr.message };
  const itemById = new Map((items as ItemConcept[] ?? []).map(i => [i.id, i]));

  const byConcept = new Map<string, { item: ItemConcept; events: SrsEvent[] }>();
  for (const event of events) {
    const item = itemById.get(event.itemId);
    if (!item) continue;
    const group = byConcept.get(item.concept_key) ?? { item, events: [] };
    group.events.push(event);
    byConcept.set(item.concept_key, group);
  }
  if (byConcept.size === 0) return result;

  const examAt = await getExamAt(supabase, owner);
  const loadCards = async (keys: string[]) => {
    const { data, error } = await supabase
      .from('srs_cards')
      .select(CARD_COLUMNS)
      .eq('owner_type', owner.type)
      .eq('owner_id', owner.id)
      .in('concept_key', keys);
    if (error) throw new Error(error.message);
    return new Map(((data ?? []) as CardRow[]).map(c => [c.concept_key, c]));
  };

  let cards: Map<string, CardRow>;
  try {
    cards = await loadCards([...byConcept.keys()]);
  } catch (e) {
    return { ...result, error: (e as Error).message };
  }

  for (const [conceptKey, { item, events: conceptEvents }] of byConcept) {
    for (let attempt = 1; attempt <= MAX_CAS_ATTEMPTS; attempt++) {
      const existing = cards.get(conceptKey) ?? null;
      const { state, createdBy, cleared } = foldEvents(existing, item.type, conceptEvents, now);
      if (!state) break; // only correct answers on an unscheduled concept

      const due = scheduleDue(state.stability, state.lastReviewAt, examAt);
      const fields = {
        stability: state.stability,
        difficulty: state.difficulty,
        reps: state.reps,
        lapses: state.lapses,
        last_review_at: state.lastReviewAt.toISOString(),
        due_at: due.toISOString(),
        updated_at: now.toISOString(),
      };

      let written: { id: number }[] | null;
      if (!existing) {
        const { data, error } = await supabase
          .from('srs_cards')
          .upsert({
            owner_id: owner.id,
            owner_type: owner.type,
            concept_key: conceptKey,
            item_type: item.type,
            skill: item.skill,
            target_lemma: item.target_lemma,
            anchor_question_id: createdBy!.itemId,
            ...fields,
          }, { onConflict: 'owner_type,owner_id,concept_key', ignoreDuplicates: true })
          .select('id');
        if (error) { result.error = error.message; break; }
        written = data;
      } else {
        const { data, error } = await supabase
          .from('srs_cards')
          .update({ ...fields, version: existing.version + 1 })
          .eq('id', existing.id)
          .eq('version', existing.version)
          .select('id');
        if (error) { result.error = error.message; break; }
        written = data;
      }

      if (written && written.length > 0) {
        if (existing) result.reviewed++; else result.created++;
        if (cleared) result.cleared++;
        break;
      }
      // Lost a race: someone else created/updated this card first. Re-read
      // and replay these events on top of their state.
      try {
        const fresh = await loadCards([conceptKey]);
        const card = fresh.get(conceptKey);
        if (card) cards.set(conceptKey, card); else cards.delete(conceptKey);
      } catch (e) {
        result.error = (e as Error).message;
        break;
      }
    }
  }

  // Ring B ("smart review") counts concepts that were due and got reviewed
  // successfully — same meaning as before, now per concept.
  if (result.cleared > 0) {
    await supabase.rpc('increment_daily_activity', {
      p_user_id: owner.id,
      p_activity_date: todayLocalStr(),
      p_source: 'review_queue',
      p_activity_units: 0,
      p_review_cleared: result.cleared,
    });
  }

  return result;
}

// ── Review retrieval ─────────────────────────────────────────────────────────

/** Answered this recently → not eligible as a sibling (it would be recognition, not recall). */
export const SIBLING_RECENCY_DAYS = 14;

export type ReviewQuestion = Question & {
  review: { conceptKey: string; sibling: boolean };
};

/**
 * The owner's due cards, each resolved to a question to serve: a random
 * sibling testing the same concept (not the card's own anchor, not anything
 * answered in the last SIBLING_RECENCY_DAYS), else the anchor itself.
 */
export async function selectDueReviewQuestions(
  supabase: SupabaseClient,
  owner: SrsOwner,
  { limit, now = new Date() }: { limit?: number; now?: Date } = {},
): Promise<{ questions: ReviewQuestion[]; error: string | null }> {
  let cardQuery = supabase
    .from('srs_cards')
    .select('concept_key, anchor_question_id, due_at')
    .eq('owner_type', owner.type)
    .eq('owner_id', owner.id)
    .lte('due_at', now.toISOString())
    .order('due_at', { ascending: true });
  if (limit) cardQuery = cardQuery.limit(limit);
  const { data: cardRows, error: cardErr } = await cardQuery;
  if (cardErr) return { questions: [], error: cardErr.message };
  const cards = (cardRows ?? []) as { concept_key: string; anchor_question_id: string }[];
  if (cards.length === 0) return { questions: [], error: null };

  const since = new Date(now.getTime() - SIBLING_RECENCY_DAYS * MS_PER_DAY).toISOString();
  const { data: recentRows } = await supabase
    .from('responses')
    .select('item_id')
    .eq('owner_type', owner.type)
    .eq('owner_id', owner.id)
    .gte('created_at', since)
    .limit(2000);
  const exclude = [...new Set([
    ...cards.map(c => c.anchor_question_id),
    ...((recentRows ?? []) as { item_id: string }[]).map(r => r.item_id),
  ])];

  const { data: siblingRows, error: sibErr } = await supabase.rpc('srs_pick_siblings', {
    p_concept_keys: cards.map(c => c.concept_key),
    p_exclude_question_ids: exclude,
  });
  if (sibErr) return { questions: [], error: sibErr.message };
  const siblingByConcept = new Map(((siblingRows ?? []) as { concept_key: string; question_id: string }[])
    .map(s => [s.concept_key, s.question_id]));

  const plan = cards.map(c => {
    const sibling = siblingByConcept.get(c.concept_key);
    return { conceptKey: c.concept_key, questionId: sibling ?? c.anchor_question_id, sibling: !!sibling };
  });

  const { data: qs, error: qErr } = await supabase
    .from('questions')
    .select('*')
    .in('id', [...new Set(plan.map(p => p.questionId))]);
  if (qErr) return { questions: [], error: qErr.message };

  const passageIds = [...new Set((qs ?? []).filter(q => q.passage_id).map(q => q.passage_id as string))];
  let passageMap: Record<string, { id: string; text: string; difficulty_level: number; b: number }> = {};
  if (passageIds.length > 0) {
    const { data: passages } = await supabase.from('passages').select('id, text, difficulty_level, b').in('id', passageIds);
    passageMap = Object.fromEntries((passages ?? []).map(p => [p.id, p]));
  }
  const byId = new Map((qs ?? []).map(q => [q.id as string, q]));

  const questions = plan
    .filter(p => byId.has(p.questionId))
    .map(p => {
      const q = byId.get(p.questionId)!;
      return {
        ...q,
        passage: q.passage_id ? passageMap[q.passage_id] : undefined,
        review: { conceptKey: p.conceptKey, sibling: p.sibling },
      } as ReviewQuestion;
    });
  return { questions, error: null };
}

/**
 * Pulls every card that would come due after the pre-exam peak window back
 * into it — used when the exam date is set or moved, so the existing
 * schedule conforms immediately instead of only as each card is next
 * reviewed. All such cards get the same capped date.
 */
export async function recapCardsToExam(
  supabase: SupabaseClient,
  owner: SrsOwner,
  examAt: Date,
  now: Date = new Date(),
): Promise<{ error: string | null }> {
  if (examAt.getTime() <= now.getTime()) return { error: null };
  const latest = new Date(examAt.getTime() - MS_PER_DAY);
  const capped = capDueToExam(new Date(examAt.getTime() + MS_PER_DAY), now, examAt);
  const { error } = await supabase
    .from('srs_cards')
    .update({ due_at: capped.toISOString(), updated_at: now.toISOString() })
    .eq('owner_type', owner.type)
    .eq('owner_id', owner.id)
    .gt('due_at', latest.toISOString());
  return { error: error?.message ?? null };
}
