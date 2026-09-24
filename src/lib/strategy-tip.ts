import type { QuestionType } from '@/types/exam';
import { GUIDE_BY_ID, GUIDE_ID_BY_QUESTION_TYPE as TYPE_TO_GUIDE, type QuestionGuide, type QuestionTypeId } from '@/data/strategies';

export interface SessionItem {
  id?: string | number | null;
  type: QuestionType;
  correct: boolean;
}

export interface ContextualTip {
  guide: QuestionGuide;
  tip: { step: string; detail: string };
  errors: number;
  total: number;
}

/**
 * Picks the post-session strategy tip: the question type the learner missed
 * most in this session (unanswered counts as a miss). Ties go to the higher
 * error rate, then to the type with more questions. A flawless session still
 * gets a tip — for the type practiced most — so the card reinforces the method.
 *
 * The tip itself is one step of that type's "stuck" protocol, chosen from the
 * session's question ids so it is stable on re-render but varies between
 * sessions. Types without a guide (e.g. esra) are ignored.
 */
export function pickContextualTip(items: SessionItem[]): ContextualTip | null {
  const stats = new Map<QuestionTypeId, { errors: number; total: number }>();
  for (const item of items) {
    const id = TYPE_TO_GUIDE[item.type];
    if (!id) continue;
    const s = stats.get(id) ?? { errors: 0, total: 0 };
    s.total += 1;
    if (!item.correct) s.errors += 1;
    stats.set(id, s);
  }
  if (stats.size === 0) return null;

  const [weakestId, weakest] = [...stats.entries()].sort(([, a], [, b]) =>
    b.errors - a.errors
    || b.errors / b.total - a.errors / a.total
    || b.total - a.total,
  )[0];

  const guide = GUIDE_BY_ID[weakestId];
  const seed = items.reduce((acc, item) => {
    const key = String(item.id ?? '');
    for (let i = 0; i < key.length; i++) acc = (acc * 31 + key.charCodeAt(i)) >>> 0;
    return acc;
  }, 0);
  const tip = guide.stuck[seed % guide.stuck.length];

  return { guide, tip, errors: weakest.errors, total: weakest.total };
}
