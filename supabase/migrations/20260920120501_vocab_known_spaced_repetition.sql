-- Turns "known" from a permanent flag into an Anki-style spaced-repetition
-- state: a word that's due again resurfaces instead of being hidden forever,
-- matching the interval-doubling/reset-on-failure pattern review_queue
-- already uses for wrong exam answers.
alter table public.user_vocab_known
  add column if not exists interval_days integer not null default 1,
  add column if not exists next_review_at timestamptz not null default now();

create index if not exists user_vocab_known_next_review_idx
  on public.user_vocab_known (user_id, next_review_at);
