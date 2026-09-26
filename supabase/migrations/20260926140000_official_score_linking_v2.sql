-- NITE score linking, step 1 of the collection upgrade (additive only).
--
-- New entry points (results page, stats page, user menu) will collect
-- scores from students who took the real test before, not only after the
-- exam date they set. This adds what the analysis needs to tell them apart
-- and to handle bad reports, and a general "prefer not to" for the new
-- entry points. Nothing existing changes meaning; the current API keeps
-- working unchanged (source defaults to the only entry point it serves).

-- Where the report came from — to measure which entry point works and to
-- detect reporting bias (e.g. only high scorers answering from one place).
alter table public.official_scores
  add column if not exists source text not null default 'exam_date_prompt';

alter table public.official_scores
  drop constraint if exists official_scores_source_check;
alter table public.official_scores
  add constraint official_scores_source_check
  check (source in ('exam_date_prompt', 'results', 'stats', 'menu'));

-- A report judged implausible (a typo like 150 against a prediction of 60)
-- is kept, never deleted, but left out of the linking fit — with a reason.
alter table public.official_scores
  add column if not exists excluded_from_linking boolean not null default false,
  add column if not exists exclusion_reason text;

alter table public.official_scores
  drop constraint if exists official_scores_exclusion_reason_check;
alter table public.official_scores
  add constraint official_scores_exclusion_reason_check
  check (not excluded_from_linking or length(trim(coalesce(exclusion_reason, ''))) > 0);

comment on column public.official_scores.source is
  'Entry point of the report: exam_date_prompt | results | stats | menu.';
comment on column public.official_scores.excluded_from_linking is
  'True when the report is left out of the linking fit (kept for the record); exclusion_reason says why.';

-- "Prefer not to" on the new entry points: stop asking for a while (the
-- app waits 60 days). The existing score_prompt_dismissed_for still covers
-- the exam-date prompt for one sitting.
alter table public.user_goals
  add column if not exists score_prompt_dismissed_at timestamptz;

comment on column public.user_goals.score_prompt_dismissed_at is
  'When the student chose "prefer not to" on a general score prompt (results / stats / menu).';

-- Analysis surface: excluded reports left out; source added at the end
-- (create or replace view can only append columns). Service role only.
create or replace view public.official_score_linking
with (security_invoker = true) as
select
  id,
  user_id,
  test_type,
  test_date,
  score as official_score,
  app_score,
  app_theta,
  app_se,
  app_p_exempt,
  app_exams_used,
  app_days_before,
  score - app_score as residual,
  (score >= 134) as exempt,
  reported_at,
  source
from public.official_scores
where app_score is not null
  and not excluded_from_linking;

revoke all on public.official_score_linking from anon, authenticated;
grant select on public.official_score_linking to service_role;
