-- NITE score linking, step 1: collect official scores against the app's own
-- prior prediction. Every report is stored as a (predicted, actual) pair —
-- the input for linking the app's θ scale to NITE's reported 50–150 scale.
-- Nothing here changes scoring; a linking function is fitted only once
-- enough pairs exist (see official_score_linking below).

create table if not exists public.official_scores (
  id bigint generated always as identity primary key,
  -- Accounts only: an official score is personal data, and only accounts
  -- have an exam date to anchor the prompt to.
  user_id uuid not null references auth.users(id) on delete cascade,
  -- AMIRNET, AMIRAM and the psychometric English section are reported on
  -- the same 50–150 scale by NITE.
  test_type text not null default 'amirnet' check (test_type in ('amirnet', 'amiram', 'psychometric')),
  score integer not null check (score between 50 and 150),
  test_date date not null,
  reported_at timestamptz not null default now(),

  -- The app's prediction as it stood BEFORE the test: the current-estimate
  -- rule the stats page uses (src/lib/exemption.ts currentEstimate) over
  -- the timed exams completed before test_date. Snapshotted at report time
  -- because it can't be faithfully rebuilt later — item calibration keeps
  -- moving the difficulties those exams were scored with. All null when
  -- the student took no timed exams before the test.
  app_theta double precision,
  app_se double precision check (app_se > 0),
  app_score integer check (app_score between 50 and 150),
  app_p_exempt double precision check (app_p_exempt between 0 and 1),
  app_exams_used integer check (app_exams_used >= 0),
  -- Days between the last pre-test exam and the test (how stale the
  -- prediction was — a linking fit should weight fresh ones more).
  app_days_before integer check (app_days_before >= 0),

  -- A retake is a new sitting; re-reporting the same sitting corrects it.
  unique (user_id, test_date)
);

create index if not exists official_scores_user_idx on public.official_scores (user_id, test_date desc);

alter table public.official_scores enable row level security;
revoke all on table public.official_scores from anon, authenticated;

comment on table public.official_scores is
  'Self-reported official NITE scores + the app''s pre-test prediction snapshot. Linking data (app θ scale → NITE 50–150).';

-- "Prefer not to share" for a given sitting — the prompt stops asking about
-- that exam date (a new exam date asks again).
alter table public.user_goals
  add column if not exists score_prompt_dismissed_for date;

-- Analysis surface for the linking fit: one row per report that has a
-- prediction, with the residual. Service role only.
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
  reported_at
from public.official_scores
where app_score is not null;

revoke all on public.official_score_linking from anon, authenticated;
grant select on public.official_score_linking to service_role;
