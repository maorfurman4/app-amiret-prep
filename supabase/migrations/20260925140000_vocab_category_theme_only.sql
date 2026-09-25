-- vocabulary.category holds the theme only: 'academic' or 'general'.
--
-- Run AFTER scripts/reset-vocab-categories.ts --apply, which rewrites the old
-- mixed values (verbs, nouns, connectors, advanced, …) — grammar now lives in
-- part_of_speech (migration 20260925120000) and difficulty in
-- difficulty_level. This constraint keeps the two from mixing again.

alter table public.vocabulary
  alter column category set default 'general';

update public.vocabulary set category = 'general' where category is null;

alter table public.vocabulary
  alter column category set not null;

alter table public.vocabulary
  drop constraint if exists vocabulary_category_check;

alter table public.vocabulary
  add constraint vocabulary_category_check
  check (category in ('academic', 'general'));

comment on column public.vocabulary.category is
  'Theme: academic (Academic Word List families + subject terms) | general. Grammar is in part_of_speech.';
