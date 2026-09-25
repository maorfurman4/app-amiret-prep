-- A word's grammar, independent of its theme.
--
-- `category` mixes the two: most rows hold a part of speech (verbs, nouns,
-- adjectives, descriptive, connectors) but 300 hold a theme (academic,
-- advanced), so those words had no part of speech at all. This adds a
-- separate column; `category` keeps the theme and is left untouched.
--
-- Additive and safe to run before the backfill: the column is nullable, and
-- the app falls back to deriving the part of speech from `category` while it
-- is empty. Backfill: scripts/backfill-part-of-speech.ts.

alter table public.vocabulary
  add column if not exists part_of_speech text;

alter table public.vocabulary
  drop constraint if exists vocabulary_part_of_speech_check;

alter table public.vocabulary
  add constraint vocabulary_part_of_speech_check
  check (part_of_speech is null or part_of_speech in ('noun', 'verb', 'adjective', 'adverb', 'connector'));

comment on column public.vocabulary.part_of_speech is
  'Grammatical role: noun | verb | adjective | adverb | connector (linking words and discourse markers). Independent of category, which holds the theme.';
