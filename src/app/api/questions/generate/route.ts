import { NextRequest, NextResponse } from 'next/server';
import { getServerClients } from '@/lib/supabase-server';
import { isAdminEmail } from '@/lib/admin';
import { generateQuestions, generatePassage } from '@/lib/ai';
import type { QuestionType, DifficultyLevel } from '@/types/exam';
import { BASELINE_A } from '@/lib/adaptive';

/**
 * POST /api/questions/generate
 * Admin-only: bulk generates questions via GPT-4o and seeds Supabase.
 * NOT called during live exams.
 */
export async function POST(req: NextRequest) {
  const { supabase, user } = await getServerClients();

  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!isAdminEmail(user.email)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const body = await req.json() as {
    type: QuestionType;
    difficulty: DifficultyLevel;
    count?: number;
    generatePassage?: boolean;
  };

  const { type, difficulty, count = 5 } = body;

  if (type === 'reading_comprehension' && body.generatePassage) {
    // First generate passage, then questions for it
    const passage = await generatePassage(difficulty);

    const { data: passageRow, error: passErr } = await supabase
      .from('passages')
      .insert({ text: passage.text, difficulty_level: difficulty, b: passage.b })
      .select()
      .single();

    if (passErr || !passageRow) {
      return NextResponse.json({ error: 'Failed to insert passage' }, { status: 500 });
    }

    const questions = await generateQuestions(type, difficulty, 5, passage.text);

    const rows = questions.map(q => ({
      type,
      text: q.text,
      passage_id: passageRow.id,
      options: q.options,
      correct_answer: q.correct_answer,
      explanation: q.explanation,
      // Model-invented discrimination is discarded — see BASELINE_A.
      a: BASELINE_A,
      b: q.b,
      c: q.c,
      difficulty_level: q.difficulty_level,
      created_by: 'ai',
    }));

    const { data: inserted, error: qErr } = await supabase
      .from('questions')
      .insert(rows)
      .select('id');

    if (qErr) return NextResponse.json({ error: qErr.message }, { status: 500 });
    return NextResponse.json({ passageId: passageRow.id, inserted: inserted?.length });
  }

  // Non-reading-comprehension or reading without new passage
  const questions = await generateQuestions(type, difficulty, count);

  const rows = questions.map(q => ({
    type,
    text: q.text,
    options: q.options,
    correct_answer: q.correct_answer,
    explanation: q.explanation,
    a: BASELINE_A,
    b: q.b,
    c: q.c,
    difficulty_level: q.difficulty_level,
    created_by: 'ai',
  }));

  const { data: inserted, error: qErr } = await supabase
    .from('questions')
    .insert(rows)
    .select('id');

  if (qErr) return NextResponse.json({ error: qErr.message }, { status: 500 });
  return NextResponse.json({ inserted: inserted?.length });
}
