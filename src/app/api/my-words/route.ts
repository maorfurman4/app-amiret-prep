import { NextRequest, NextResponse } from 'next/server';
import { getServerClients } from '@/lib/supabase-server';

/**
 * GET /api/my-words?guestId=xxx
 * Personal vocabulary built from the user's own mistakes:
 * every sentence-completion question they got wrong (tracked in
 * review_queue) contributes its correct word as a flashcard.
 * Graduating a question out of the review queue removes the word — mastered.
 */
export async function GET(req: NextRequest) {
  const { supabase, user } = await getServerClients();
  const guestId = req.nextUrl.searchParams.get('guestId');
  if (!user && !guestId) return NextResponse.json({ words: [] });

  let q = supabase.from('review_queue').select('question_id, times_wrong');
  q = user ? q.eq('user_id', user.id) : q.eq('guest_id', guestId!);
  const { data: queue } = await q;
  if (!queue || queue.length === 0) return NextResponse.json({ words: [] });

  const wrongCount = Object.fromEntries(queue.map(r => [r.question_id as string, r.times_wrong as number]));
  const { data: questions } = await supabase
    .from('questions')
    .select('id, text, options, correct_answer, explanation, difficulty_level')
    .in('id', Object.keys(wrongCount))
    .eq('type', 'sentence_completion');

  const words = (questions ?? []).map(qu => {
    const opts = qu.options as { text: string }[];
    const word = opts?.[qu.correct_answer as number]?.text ?? '';
    // Hebrew gloss from the explanation convention: "word = תרגום. ..."
    let hebrew = '';
    let definition = '';
    try {
      const ex = JSON.parse(qu.explanation as string) as { correct_reason?: string };
      const cr = ex.correct_reason ?? '';
      const m = cr.match(/=\s*([^.—]{1,40})/);
      hebrew = m ? m[1].trim() : '';
      definition = cr;
    } catch { /* no explanation */ }
    return {
      id: qu.id as string,
      word,
      hebrew_translation: hebrew || '—',
      definition,
      example_sentence: (qu.text as string).replace('___', word),
      category: 'my-mistakes',
      difficulty_level: qu.difficulty_level as number,
      times_wrong: wrongCount[qu.id as string] ?? 1,
    };
  }).filter(w => w.word);

  // Most-failed words first
  words.sort((a, b) => b.times_wrong - a.times_wrong);
  return NextResponse.json({ words });
}
