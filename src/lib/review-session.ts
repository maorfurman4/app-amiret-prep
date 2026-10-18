import { isCorrectAnswer, type Question } from '@/types/exam';

/**
 * Correct answers in a review round, counted from what is still in it. A
 * separate running counter wasn't decremented when a question was removed
 * mid-round, so the summary could read "2/1 · 200%".
 */
export function countCorrect(questions: Question[], answers: (number | null)[]): number {
  return questions.reduce((n, q, i) => n + (isCorrectAnswer(q, answers[i] ?? null) ? 1 : 0), 0);
}

/**
 * Puts a question whose removal failed back where it was (by its old index
 * in `before`), unless it is already there.
 */
export function restoreQuestion(current: Question[], before: Question[], questionId: string): Question[] {
  if (current.some(q => q.id === questionId)) return current;
  const idx = before.findIndex(q => q.id === questionId);
  if (idx === -1) return current;
  // Insert after the nearest earlier question that is still present.
  const prevIds = new Set(before.slice(0, idx).map(q => q.id));
  let at = 0;
  current.forEach((q, i) => { if (prevIds.has(q.id)) at = i + 1; });
  return [...current.slice(0, at), before[idx], ...current.slice(at)];
}
