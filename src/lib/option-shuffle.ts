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

/**
 * Uniform [0, 1) from the platform CSPRNG (Web Crypto — available in the
 * Node runtime and every browser). Math.random is statistically fine but
 * its xorshift state is recoverable from outputs; answer positions should
 * be unpredictable, not merely fair.
 */
export function secureRandom(): number {
  const buf = new Uint32Array(1);
  crypto.getRandomValues(buf);
  return buf[0] / 0x1_0000_0000;
}

/** Unbiased Fisher–Yates. */
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

/**
 * `targetPosition`, when given, is where the correct option must land; the
 * distractors still fill the other slots in uniformly random order.
 */
export function shuffleQuestionOptions<Q extends Question>(
  question: Q,
  rng: Rng = secureRandom,
  targetPosition?: number,
): ShuffledQuestion<Q> {
  const n = question.options.length;
  const key = question.correct_answer;
  let order: number[];
  if (targetPosition !== undefined && targetPosition >= 0 && targetPosition < n && key >= 0 && key < n) {
    const distractors = permutation(n, rng).filter(i => i !== key);
    order = [];
    for (let slot = 0, d = 0; slot < n; slot++) order.push(slot === targetPosition ? key : distractors[d++]);
  } else {
    order = permutation(n, rng);
  }
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

/**
 * Correct-answer positions for a batch of `n` questions with `k` options.
 *
 * Independent uniform draws clump: in a 5-question session about 1 in 16
 * puts 4+ answers in the same slot ("the answer is always C"), which looks
 * broken and trains students to read the key instead of the question. So
 * draws are rejection-sampled to exclude clumps — no position more than
 * ⌈n/k⌉+1 times, and never three in a row. The constraints are symmetric in
 * the positions, so each question's correct position is still exactly
 * uniform on its own. The key is deliberately NOT fully balanced (e.g. one
 * per slot in a 4-question section): that would let a student deduce the
 * last answer from the others.
 */
export function keyPositions(n: number, k = 4, rng: Rng = secureRandom): number[] {
  const cap = Math.ceil(n / k) + 1;
  let draw: number[] = [];
  for (let attempt = 0; attempt < 500; attempt++) {
    draw = Array.from({ length: n }, () => Math.floor(rng() * k));
    const counts = new Array(k).fill(0);
    draw.forEach(p => counts[p]++);
    const clumped = counts.some(c => c > cap);
    const run = draw.some((p, i) => i >= 2 && p === draw[i - 1] && p === draw[i - 2]);
    if (!clumped && !run) return draw;
  }
  return draw; // unreachable in practice: valid draws are the majority
}

/** Shuffles a batch served together, with an anti-clumping answer key. */
export function shuffleAllOptions<Q extends Question>(questions: Q[], rng: Rng = secureRandom): ShuffledQuestion<Q>[] {
  const targets = keyPositions(questions.length, 4, rng);
  return questions.map((q, i) => shuffleQuestionOptions(q, rng, q.options.length === 4 ? targets[i] : undefined));
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
