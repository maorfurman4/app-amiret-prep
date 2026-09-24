import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getServerClients } from '@/lib/supabase-server';
import { itemIrtParams } from '@/lib/adaptive';
import { planInformativeQuestions } from '@/lib/item-selection';
import { recordSeenQuestions } from '@/lib/question-history';
import { shuffleAllOptions } from '@/lib/option-shuffle';
import {
  DIAGNOSTIC, DIAGNOSTIC_TYPES, buildStartPlan, diagnosticState,
  type DiagnosticType, type ScoredItem,
} from '@/lib/diagnostic-plan';

/**
 * POST /api/diagnostic/next
 * One step of the onboarding diagnostic (src/lib/diagnostic-plan.ts).
 * Stateless: the client sends every answer so far, as canonical option
 * indices; the server re-scores them against the stored item parameters
 * (never client-supplied ones), then either returns the next most
 * informative item or — once the stopping rule fires — the start plan.
 */
const bodySchema = z.object({
  answers: z.array(z.object({
    id: z.guid(),
    chosen: z.int().min(0).max(3),
  })).max(DIAGNOSTIC.maxItems),
});

type ItemRow = {
  id: string;
  type: string;
  b: number;
  c: number | null;
  b_calibrated: number | null;
  correct_answer: number;
};

export async function POST(req: NextRequest) {
  const { supabase, user, guestId } = await getServerClients();
  const userKey = user?.id ?? guestId ?? null;
  if (!userKey) return NextResponse.json({ error: 'auth required' }, { status: 401 });

  let rawBody: unknown;
  try {
    rawBody = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }
  const parsed = bodySchema.safeParse(rawBody);
  if (!parsed.success) return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
  const { answers } = parsed.data;

  const ids = answers.map(a => a.id);
  if (new Set(ids).size !== ids.length) {
    return NextResponse.json({ error: 'Duplicate item' }, { status: 400 });
  }

  let items: ScoredItem[] = [];
  if (ids.length > 0) {
    const { data, error } = await supabase
      .from('questions')
      .select('id, type, b, c, b_calibrated, correct_answer')
      .in('id', ids);
    if (error) return NextResponse.json({ error: 'Lookup failed' }, { status: 500 });
    const byId = new Map(((data ?? []) as ItemRow[]).map(r => [r.id, r]));
    for (const a of answers) {
      const row = byId.get(a.id);
      if (!row || !(DIAGNOSTIC_TYPES as readonly string[]).includes(row.type)) {
        return NextResponse.json({ error: 'Unknown item' }, { status: 400 });
      }
      items = [...items, {
        type: row.type as DiagnosticType,
        params: itemIrtParams(row),
        correct: a.chosen === row.correct_answer,
      }];
    }
  }

  const state = diagnosticState(items);
  if (state.done) {
    return NextResponse.json({ done: true, state, plan: buildStartPlan(items) });
  }

  const [next] = await planInformativeQuestions({
    supabase, userKey, type: state.nextType, theta: state.theta, needed: 1, excludeIds: ids,
  });
  if (!next) return NextResponse.json({ error: 'No questions available' }, { status: 503 });
  await recordSeenQuestions(supabase, userKey, [next.id]);

  return NextResponse.json({ done: false, state, question: shuffleAllOptions([next])[0] });
}
