/**
 * Keeps a set of questions from sharing answer choices. A word that shows up
 * as an option in two questions of the same exam (or practice set) teaches
 * the student something the test never meant to: "frugal" three times as a
 * wrong answer means frugal is never the answer, and a word that is the
 * answer to one question and a distractor in another gives the second away.
 *
 * Only short options count (single words and short phrases, as in sentence
 * completion). Full-sentence options — restatement, reading — would collide
 * on common words and never repeat verbatim anyway.
 */

type WithOptions = { options?: { text: string }[] | null };

/** Options longer than this many words are sentences, not choices to compare. */
const MAX_OPTION_WORDS = 3;

export function optionWords(q: WithOptions): string[] {
  return (q.options ?? [])
    .map(o => o.text.trim().toLowerCase().replace(/\s+/g, ' '))
    .filter(t => t && t.split(' ').length <= MAX_OPTION_WORDS);
}

/** Every short option across these questions — to avoid in the next pick. */
export function usedOptionWords(questions: WithOptions[]): Set<string> {
  return new Set(questions.flatMap(optionWords));
}

/**
 * Takes `needed` questions from `candidates` (kept in their given order, so
 * the caller's ranking and randomness still decide) such that no two chosen
 * questions — and no chosen question and `avoid` — share an option. When the
 * pool cannot fill the set that way, the rest is filled with the candidates
 * that overlap least, so a set is never left short.
 */
export function pickDistinctOptions<T extends WithOptions>(candidates: T[], needed: number, avoid: Iterable<string> = []): T[] {
  const used = new Set(avoid);
  const chosen: T[] = [];
  const skipped: T[] = [];
  for (const q of candidates) {
    if (chosen.length === needed) break;
    const words = optionWords(q);
    if (words.some(w => used.has(w))) { skipped.push(q); continue; }
    chosen.push(q);
    words.forEach(w => used.add(w));
  }
  while (chosen.length < needed && skipped.length) {
    skipped.sort((a, b) => optionWords(a).filter(w => used.has(w)).length - optionWords(b).filter(w => used.has(w)).length);
    const q = skipped.shift()!;
    chosen.push(q);
    optionWords(q).forEach(w => used.add(w));
  }
  return chosen;
}
