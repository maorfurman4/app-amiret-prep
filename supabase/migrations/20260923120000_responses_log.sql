-- Engine foundation: one row per answered item, across every surface that
-- serves questions (exam, practice, review queue, diagnostic). Until now the
-- only durable trace of an answer was either buried in exam_sessions JSONB
-- or — for practice — nothing at all unless it was wrong (review_queue).
-- Item calibration, spaced-repetition scheduling, pacing analytics and any
-- ability estimate beyond a single exam all need this log as their input.
create table if not exists public.responses (
  id bigint generated always as identity primary key,
  -- Same identity model as review_queue: an account uuid or a guest uuid,
  -- disambiguated by owner_type. merge-guest re-homes guest rows on login.
  owner_id text not null,
  owner_type text not null check (owner_type in ('user', 'guest')),
  item_id uuid not null references public.questions(id) on delete cascade,
  context text not null check (context in ('exam', 'practice', 'review', 'diagnostic')),
  -- Always graded server-side against questions.correct_answer.
  correct boolean not null,
  -- Canonical (stored) option index, never the shuffled display position.
  -- null = the item was presented but left unanswered (exam blank/timeout).
  chosen_option smallint check (chosen_option between 0 and 3),
  -- Time spent on the item before the final answer. For free-navigation
  -- formats (exam sections, practice section mode) this is total dwell
  -- time across every visit to the item within that section.
  latency_ms integer check (latency_ms >= 0),
  -- Self-reported certainty, 1 (guess) .. 3 (sure), when a surface asks.
  confidence smallint check (confidence between 1 and 3),
  -- Ability estimate in effect when the item was served, when one exists
  -- (exam: θ before the section; diagnostic: running EAP).
  theta_before double precision,
  -- Exam section number (1-7) / diagnostic stage number (1-4).
  section_index smallint check (section_index between 1 and 20),
  -- Exam sessions only. Abandoned in-progress exams are deleted on exit,
  -- but sections already answered were real responses — keep them.
  session_id uuid references public.exam_sessions(id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists responses_owner_created_idx
  on public.responses (owner_id, created_at desc);
create index if not exists responses_item_idx
  on public.responses (item_id);
create index if not exists responses_session_idx
  on public.responses (session_id) where session_id is not null;

-- Locked down like every other table the app owns: no policies, service
-- role only, all access through API routes that establish ownership.
alter table public.responses enable row level security;
revoke all on table public.responses from anon, authenticated;

comment on table public.responses is
  'One row per answered (or presented-and-left-blank) item. Written by /api/exam/answer (via commit_exam_section) and /api/responses.';

-- commit_exam_section gains p_responses so a section's response rows commit
-- in the same transaction as the section itself — exactly once, and never
-- for a submission that lost the concurrency race. Adding a parameter
-- changes the function's identity, so the old signature is dropped first
-- (leaving both would make PostgREST's named-argument resolution ambiguous).
drop function if exists public.commit_exam_section(uuid, text, integer, jsonb, uuid[], uuid[], boolean, uuid, date, text, uuid[], text);

create or replace function public.commit_exam_section(
  p_session_id uuid,
  p_owner_id text,
  p_section_index integer,
  p_update jsonb,
  p_reset_question_ids uuid[] default '{}'::uuid[],
  p_seen_question_ids uuid[] default '{}'::uuid[],
  p_reset_passage_history boolean default false,
  p_seen_passage_id uuid default null,
  p_activity_date date default null,
  p_activity_source text default null,
  p_wrong_question_ids uuid[] default '{}'::uuid[],
  p_review_owner_type text default null,
  p_responses jsonb default '[]'::jsonb
)
returns boolean
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_updated integer;
  v_question_id uuid;
begin
  update public.exam_sessions as session
  set
    theta = (p_update->>'theta')::double precision,
    theta_history = p_update->'theta_history',
    current_section_index = (p_update->>'current_section_index')::integer,
    answers_by_section = p_update->'answers_by_section',
    section_results = p_update->'section_results',
    completed_at = case when p_update ? 'completed_at' then (p_update->>'completed_at')::timestamptz else session.completed_at end,
    theta_final = case when p_update ? 'theta_final' then (p_update->>'theta_final')::double precision else session.theta_final end,
    score = case when p_update ? 'score' then (p_update->>'score')::integer else session.score end,
    current_section_expires_at = case when p_update ? 'current_section_expires_at' then (p_update->>'current_section_expires_at')::timestamptz else session.current_section_expires_at end,
    used_question_ids = case when p_update ? 'used_question_ids' then array(select value::uuid from jsonb_array_elements_text(p_update->'used_question_ids')) else session.used_question_ids end,
    used_passage_ids = case when p_update ? 'used_passage_ids' then array(select value::uuid from jsonb_array_elements_text(p_update->'used_passage_ids')) else session.used_passage_ids end,
    questions_by_section = case when p_update ? 'questions_by_section' then p_update->'questions_by_section' else session.questions_by_section end
  where session.id = p_session_id
    and session.user_id::text = p_owner_id
    and session.current_section_index = p_section_index
    and session.completed_at is null;

  get diagnostics v_updated = row_count;
  if v_updated = 0 then
    return false;
  end if;

  if cardinality(p_reset_question_ids) > 0 then
    delete from public.user_question_history
    where user_key = p_owner_id and question_id = any(p_reset_question_ids);
  end if;

  if cardinality(p_seen_question_ids) > 0 then
    insert into public.user_question_history (user_key, question_id)
    select p_owner_id, question_id from unnest(p_seen_question_ids) as question_id
    on conflict (user_key, question_id) do nothing;
  end if;

  if p_reset_passage_history then
    delete from public.user_passage_history where user_key = p_owner_id;
  end if;

  if p_seen_passage_id is not null then
    insert into public.user_passage_history (user_key, passage_id)
    values (p_owner_id, p_seen_passage_id)
    on conflict (user_key, passage_id) do nothing;
  end if;

  if p_activity_date is not null and p_activity_source is not null then
    insert into public.activity_log (user_id, activity_date, source, activity_units)
    values (p_owner_id, p_activity_date, p_activity_source, 1)
    on conflict (user_id, activity_date) do update set
      activity_units = activity_log.activity_units + 1;
  end if;

  if cardinality(p_wrong_question_ids) > 0 then
    foreach v_question_id in array p_wrong_question_ids loop
      if p_review_owner_type = 'user' then
        insert into public.review_queue (user_id, question_id, times_wrong, next_review_at, last_reviewed_at, interval_days)
        values (p_owner_id::uuid, v_question_id, 1, now(), now(), 1)
        on conflict (user_id, question_id) where user_id is not null do update set
          times_wrong = public.review_queue.times_wrong + 1,
          next_review_at = now(),
          last_reviewed_at = now(),
          interval_days = 1;
      elsif p_review_owner_type = 'guest' then
        insert into public.review_queue (guest_id, question_id, times_wrong, next_review_at, last_reviewed_at, interval_days)
        values (p_owner_id, v_question_id, 1, now(), now(), 1)
        on conflict (guest_id, question_id) do update set
          times_wrong = public.review_queue.times_wrong + 1,
          next_review_at = now(),
          last_reviewed_at = now(),
          interval_days = 1;
      end if;
    end loop;
  end if;

  -- The join skips any item hard-deleted from the bank since it was served
  -- (its FK would fail) — logging must never be able to block a section
  -- submission.
  if jsonb_array_length(p_responses) > 0 then
    insert into public.responses (
      owner_id, owner_type, item_id, context, correct, chosen_option,
      latency_ms, theta_before, section_index, session_id
    )
    select
      p_owner_id, r.owner_type, r.item_id, r.context, r.correct, r.chosen_option,
      r.latency_ms, r.theta_before, r.section_index, p_session_id
    from jsonb_to_recordset(p_responses) as r(
      owner_type text,
      item_id uuid,
      context text,
      correct boolean,
      chosen_option smallint,
      latency_ms integer,
      theta_before double precision,
      section_index smallint
    )
    join public.questions as q on q.id = r.item_id;
  end if;

  return true;
end;
$$;

revoke execute on function public.commit_exam_section(uuid, text, integer, jsonb, uuid[], uuid[], boolean, uuid, date, text, uuid[], text, jsonb) from public, anon, authenticated;
grant execute on function public.commit_exam_section(uuid, text, integer, jsonb, uuid[], uuid[], boolean, uuid, date, text, uuid[], text, jsonb) to service_role;
