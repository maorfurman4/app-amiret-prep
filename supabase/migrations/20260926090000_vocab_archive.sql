-- Soft removal for vocabulary words: an archived word stays in the table (so
-- users' known / favorite rows and their review schedules are kept) but the
-- app no longer shows it, and it does not count toward the 350 words per
-- level. Reversible: set is_archived back to false.
--
-- Additive and safe before the app change: every existing word defaults to
-- active.

alter table public.vocabulary
  add column if not exists is_archived boolean not null default false;

create index if not exists vocabulary_active_level_idx
  on public.vocabulary (difficulty_level)
  where not is_archived;

comment on column public.vocabulary.is_archived is
  'Hidden from the app and not counted per level; user progress on the word is kept.';
