/**
 * Hebrew number + noun agreement for UI copy: "שאלה אחת", "שתי שאלות",
 * "יומיים", "5 שאלות" — never "1 שאלות" or "2 ימים".
 */
export interface HebrewNoun {
  one: string;
  many: string;
  gender: 'm' | 'f';
  /** A dual form used for exactly 2 ("יומיים"), when Hebrew has one. */
  dual?: string;
}

export const NOUNS = {
  question: { one: 'שאלה', many: 'שאלות', gender: 'f' },
  day: { one: 'יום', many: 'ימים', gender: 'm', dual: 'יומיים' },
  exam: { one: 'מבחן', many: 'מבחנים', gender: 'm' },
  minute: { one: 'דקה', many: 'דקות', gender: 'f', dual: 'שתי דקות' },
  word: { one: 'מילה', many: 'מילים', gender: 'f' },
  mistake: { one: 'טעות', many: 'טעויות', gender: 'f' },
  point: { one: 'נקודה', many: 'נקודות', gender: 'f' },
  second: { one: 'שנייה', many: 'שניות', gender: 'f' },
} as const satisfies Record<string, HebrewNoun>;

export type NounKey = keyof typeof NOUNS;

/** "שאלה אחת" / "שתי שאלות" / "יומיים" / "5 שאלות". */
export function heCount(n: number, noun: NounKey | HebrewNoun): string {
  const w: HebrewNoun = typeof noun === 'string' ? NOUNS[noun] : noun;
  if (n === 1) return `${w.one} ${w.gender === 'm' ? 'אחד' : 'אחת'}`;
  if (n === 2) return w.dual ?? `${w.gender === 'm' ? 'שני' : 'שתי'} ${w.many}`;
  return `${n} ${w.many}`;
}

/** Picks the singular or plural form of a word that agrees with a count (verbs, adjectives). */
export function agree(n: number, one: string, many: string): string {
  return n === 1 ? one : many;
}
