import { NextRequest, NextResponse } from 'next/server';
import { getServerClients } from '@/lib/supabase-server';
import type { Question, QuestionType, DifficultyLevel } from '@/types/exam';

function fisherYates<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/**
 * GET /api/practice/questions
 * Returns a set of questions for focused section practice.
 * No session created — stateless, client manages progress.
 *
 * Query params:
 *   type     — sentence_completion | restatement | reading_comprehension
 *   difficulty — 1-5 | "random"
 *   count    — 5 | 10 (ignored for reading_comprehension, always returns 5)
 */
export async function GET(req: NextRequest) {
  const { supabase } = await getServerClients();

  const { searchParams } = req.nextUrl;
  const type = searchParams.get('type') as QuestionType | null;
  const diffParam = searchParams.get('difficulty') ?? 'random';
  const countParam = parseInt(searchParams.get('count') ?? '5', 10);

  if (!type || !['sentence_completion', 'restatement', 'reading_comprehension'].includes(type)) {
    return NextResponse.json({ error: 'Invalid type' }, { status: 400 });
  }

  const count = [5, 10].includes(countParam) ? countParam : 5;

  const difficulty: DifficultyLevel = diffParam === 'random'
    ? (Math.ceil(Math.random() * 5) as DifficultyLevel)
    : (Math.max(1, Math.min(5, parseInt(diffParam, 10))) as DifficultyLevel);

  if (type === 'reading_comprehension') {
    // For random: pick a random passage from any difficulty level
    let passageQuery = supabase.from('passages').select('id, text, difficulty_level, b').eq('active', true).limit(100);
    if (diffParam !== 'random') passageQuery = passageQuery.eq('difficulty_level', difficulty);

    const { data: passages } = await passageQuery;

    if (!passages?.length) {
      return NextResponse.json({ error: 'No passages found for this difficulty' }, { status: 404 });
    }

    const passage = passages[Math.floor(Math.random() * passages.length)];

    const { data: qs } = await supabase
      .from('questions')
      .select('*')
      .eq('type', 'reading_comprehension')
      .eq('passage_id', passage.id)
      .eq('active', true)
      .limit(5);

    const questions: Question[] = (qs ?? []).map(q => ({
      ...q,
      passage: { id: passage.id, text: passage.text, difficulty_level: passage.difficulty_level, b: passage.b },
    })) as Question[];

    return NextResponse.json({ questions, difficulty: passage.difficulty_level });
  }

  // sentence_completion or restatement
  if (diffParam === 'random') {
    // Random mode: fetch questions from ALL difficulty levels and mix them
    const LEVELS: DifficultyLevel[] = [1, 2, 3, 4, 5];
    const perLevel = Math.ceil((count * 2) / 5); // fetch extra per level then trim
    const fetches = await Promise.all(
      LEVELS.map(lv =>
        supabase.from('questions').select('*').eq('type', type).eq('difficulty_level', lv).eq('active', true).limit(perLevel + 5)
      )
    );
    const pool = fetches.flatMap(r => r.data ?? []) as Question[];
    if (!pool.length) {
      return NextResponse.json({ error: 'No questions found' }, { status: 404 });
    }
    const questions = fisherYates(pool).slice(0, count);
    return NextResponse.json({ questions, difficulty: 'random' });
  }

  const { data: qs } = await supabase
    .from('questions')
    .select('*')
    .eq('type', type)
    .eq('difficulty_level', difficulty)
    .eq('active', true)
    .limit(count + 10);

  if (!qs?.length) {
    return NextResponse.json({ error: 'No questions found for this difficulty' }, { status: 404 });
  }

  const questions = fisherYates(qs as Question[]).slice(0, count);

  return NextResponse.json({ questions, difficulty });
}
