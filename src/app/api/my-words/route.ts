import { NextResponse } from 'next/server';
import { getServerClients } from '@/lib/supabase-server';
import { extractGloss } from '@/lib/vocab-text';

/** A concept this stable (≈ 3 weeks until recall drops to 90%) is treated
 * as learned and leaves the list. */
const MASTERED_STABILITY_DAYS = 21;

/**
 * GET /api/my-words
 * Personal vocabulary built from the user's own mistakes: every
 * sentence-completion word they have a spaced-repetition card for (i.e.
 * got wrong at least once) becomes a flashcard, shown via the question
 * that created the card. Words whose FSRS stability passes
 * MASTERED_STABILITY_DAYS drop off — learned.
 */
export async function GET() {
  const { supabase, user, guestId } = await getServerClients();
  const ownerId = user?.id ?? guestId;
  if (!ownerId) return NextResponse.json({ words: [] });

  const { data: cards } = await supabase
    .from('srs_cards')
    .select('anchor_question_id, lapses')
    .eq('owner_type', user ? 'user' : 'guest')
    .eq('owner_id', ownerId)
    .eq('item_type', 'sentence_completion')
    .lt('stability', MASTERED_STABILITY_DAYS);
  if (!cards || cards.length === 0) return NextResponse.json({ words: [] });

  const wrongCount = Object.fromEntries(cards.map(r => [r.anchor_question_id as string, r.lapses as number]));
  const { data: questions } = await supabase
    .from('questions')
    .select('id, text, options, correct_answer, explanation, difficulty_level')
    .in('id', Object.keys(wrongCount))
    .eq('type', 'sentence_completion');

  const words = (questions ?? []).map(qu => {
    const opts = qu.options as { text: string }[];
    const word = opts?.[qu.correct_answer as number]?.text ?? '';
    // Hebrew gloss from the explanation: "word (תרגום). ..." (older rows: "word = תרגום")
    let hebrew = '';
    let definition = '';
    try {
      const ex = JSON.parse(qu.explanation as string) as { correct_reason?: string };
      const cr = ex.correct_reason ?? '';
      hebrew = extractGloss(cr);
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
