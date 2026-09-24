-- Phase 3: error-cause tagging and the simulation pace hint.
-- Purely additive (nullable columns + indexes): code that predates it keeps
-- working unchanged, so this can be applied before the code that uses it.

-- ── 1. Error cause on the responses log ──────────────────────────────────────
-- After a wrong answer the student may tag why it went wrong. At most one
-- cause per response, so it lives on the row itself.
alter table public.responses
  -- Client-generated id for rows logged from the browser (practice, review
  -- queue): the log is fire-and-forget and never returns row ids, so a tag
  -- that arrives seconds later finds its row by this. Exam rows are written
  -- server-side and are found by (session_id, item_id) instead.
  add column if not exists client_ref uuid,
  add column if not exists error_cause text
    check (error_cause in ('vocab', 'logic', 'time', 'careless')),
  add column if not exists error_tagged_at timestamptz;

-- A tag may only describe a wrong answer.
alter table public.responses
  drop constraint if exists responses_error_cause_wrong_only;
alter table public.responses
  add constraint responses_error_cause_wrong_only
  check (error_cause is null or correct = false);

create unique index if not exists responses_owner_client_ref_idx
  on public.responses (owner_id, client_ref)
  where client_ref is not null;

-- "Why am I losing points" reads (Phase 3b) scan only tagged rows.
create index if not exists responses_owner_error_cause_idx
  on public.responses (owner_id, created_at desc)
  where error_cause is not null;

comment on column public.responses.error_cause is
  'Student-reported cause of a wrong answer: vocab | logic | time | careless. Set via /api/responses/tag.';

-- ── 2. Pace hint in the simulation ───────────────────────────────────────────
-- Whether the pace gauge was shown when the exam started (the "real exam
-- mode" toggle hides it), so its effect on accuracy and completion can be
-- measured. null = the exam predates the gauge.
alter table public.exam_sessions
  add column if not exists pace_hint_enabled boolean;
