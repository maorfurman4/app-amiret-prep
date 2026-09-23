import type { Question } from '@/types/exam';

/**
 * Per-presentation option shuffling for practice and review.
 *
 * Re-serving an item with its options in the stored order lets a student
 * "learn" that the answer is C instead of learning why — so every practice
 * and review surface gets a fresh permutation each time it's served.
 *
 * The returned question is self-consistent in display order: `options`,
 * `correct_answer`, and the explanation's per-option `options_analysis` are
 * all permuted together, so existing rendering/grading code keeps working
 * on display indices unchanged. `option_order` records the permutation
 * (display index → canonical index) so anything persisted — the responses
 * log in particular — can always be written in the canonical, stored order
 * via `toCanonicalOption`, independent of how the options happened to be
 * shown that time.
 */
export type ShuffledQuestion<Q extends Question = Question> = Q & { option_order: number[] };

type Rng = () => number;

function permutation(n: number, rng: Rng): number[] {
  const order = Array.from({ length: n }, (_, i) => i);
  for (let i = n - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [order[i], order[j]] = [order[j], order[i]];
  }
  return order;
}

/**
 * Explanations are stored as a JSON string whose `options_analysis` array is
 * aligned to the stored option order. Anything that doesn't parse into that
 * exact shape is returned unchanged — it carries no per-option alignment to
 * break.
 */
function permuteExplanation(raw: string | undefined, order: number[]): string | undefined {
  if (!raw) return raw;
  try {
    const parsed = JSON.parse(raw) as { options_analysis?: unknown };
    if (!Array.isArray(parsed.options_analysis) || parsed.options_analysis.length !== order.length) return raw;
    const analysis = parsed.options_analysis;
    return JSON.stringify({ ...parsed, options_analysis: order.map(canonical => analysis[canonical]) });
  } catch {
    return raw;
  }
}

export function shuffleQuestionOptions<Q extends Question>(question: Q, rng: Rng = Math.random): ShuffledQuestion<Q> {
  const order = permutation(question.options.length, rng);
  const displayCorrect = order.indexOf(question.correct_answer);
  return {
    ...question,
    options: order.map(canonical => question.options[canonical]),
    // A row without a (valid) key keeps it as-is rather than inventing one.
    correct_answer: displayCorrect === -1 ? question.correct_answer : displayCorrect,
    explanation: permuteExplanation(question.explanation, order),
    option_order: order,
  };
}

export function shuffleAllOptions<Q extends Question>(questions: Q[], rng: Rng = Math.random): ShuffledQuestion<Q>[] {
  return questions.map(q => shuffleQuestionOptions(q, rng));
}

/**
 * Maps an option index as displayed back to the canonical stored index.
 * Questions that were never shuffled (no `option_order`) are already in
 * canonical order. A blank answer stays blank.
 */
export function toCanonicalOption(question: Pick<Question, 'options'> & { option_order?: number[] }, displayIndex: number | null): number | null {
  if (displayIndex === null) return null;
  const order = question.option_order;
  if (!order) return displayIndex;
  return order[displayIndex] ?? null;
}
