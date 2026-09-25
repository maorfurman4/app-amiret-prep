/**
 * A vocabulary word's grammatical role, kept apart from its theme.
 * `part_of_speech` is the source of truth (migration
 * 20260925120000_vocab_part_of_speech.sql). Until a row has one, it is
 * derived from the legacy `category`, which held a part of speech for most
 * words; themed words (academic, advanced) have none until the backfill.
 */
export const PARTS_OF_SPEECH = ['noun', 'verb', 'adjective', 'adverb', 'connector'] as const;
export type PartOfSpeech = (typeof PARTS_OF_SPEECH)[number];

export const PART_OF_SPEECH_LABEL: Record<PartOfSpeech, string> = {
  noun: 'שמות עצם',
  verb: 'פעלים',
  adjective: 'שמות תואר',
  adverb: 'תוארי פועל',
  connector: 'מילות קישור',
};

/** Singular, for the tag on a single card. */
export const PART_OF_SPEECH_TAG: Record<PartOfSpeech, string> = {
  noun: 'שם עצם',
  verb: 'פועל',
  adjective: 'שם תואר',
  adverb: 'תואר פועל',
  connector: 'מילת קישור',
};

const FROM_CATEGORY: Record<string, PartOfSpeech> = {
  nouns: 'noun',
  verbs: 'verb',
  adjectives: 'adjective',
  descriptive: 'adjective',
  connectors: 'connector',
};

/** Themes that live in `category` alongside the old part-of-speech values. */
export const THEME_LABEL: Record<string, string> = {
  academic: 'אקדמי',
  advanced: 'מתקדם',
};

export function partOfSpeechOf(w: { part_of_speech?: string | null; category?: string | null }): PartOfSpeech | null {
  if (w.part_of_speech && (PARTS_OF_SPEECH as readonly string[]).includes(w.part_of_speech)) return w.part_of_speech as PartOfSpeech;
  return (w.category && FROM_CATEGORY[w.category]) || null;
}
