-- Learning rings: every ring is now derived on the server from verified
-- learning data instead of client-reported unit counts.
--   Ring A (effort)     ← responses.p_correct: practice answered inside the
--                         student's "sweet spot" of difficulty.
--   Ring B (retention)  ← srs_review_log.was_due: FSRS reviews of cards that
--                         were actually due.
--   Ring C (simulation) ← exam_sessions: a completed full exam this week.

-- ── Ring A input ─────────────────────────────────────────────────────────────

-- The model's probability that this student answers this item correctly,
-- computed server-side when the answer is logged, from the ability
-- estimate in effect at that moment (and the baseline IRT parameters). Set
-- at write time so a day's effort count can never shift retroactively as
-- the ability estimate moves later.
alter table public.responses
  add column if not exists p_correct double precision check (p_correct between 0 and 1);

-- ── Ring B input (and the FSRS optimizer's training data) ────────────────────

-- One row per state change of an FSRS card: its creation and every review.
-- was_due is decided by the server from the card's own due_at at the moment
-- of review — the only way a review can count toward Ring B, which closes
-- the old "wrong, then immediately right" loop (a fresh mistake is never
-- due). The before/after state and real elapsed time are exactly what
-- re-fitting FSRS weights on this app's own students will need.
create table if not exists public.srs_review_log (
  id bigint generated always as identity primary key,
  owner_id text not null,
  owner_type text not null check (owner_type in ('user', 'guest')),
  card_id bigint references public.srs_cards(id) on delete set null,
  concept_key text not null,
  item_id uuid references public.questions(id) on delete set null,
  grade smallint not null check (grade between 1 and 4),
  -- false for a presented-but-blank item (graded Again, but not "completed").
  answered boolean not null,
  was_due boolean not null,
  -- null for the review that created the card.
  elapsed_days double precision check (elapsed_days >= 0),
  stability_before double precision,
  stability_after double precision not null,
  difficulty_before double precision,
  difficulty_after double precision not null,
  reviewed_at timestamptz not null
);

create index if not exists srs_review_log_owner_reviewed_idx
  on public.srs_review_log (owner_id, reviewed_at);

alter table public.srs_review_log enable row level security;
revoke all on table public.srs_review_log from anon, authenticated;

comment on table public.srs_review_log is
  'FSRS review history (creation + every review). Drives Ring B; training data for re-fitting FSRS weights.';

-- ── Exam rows carry p_correct too ────────────────────────────────────────────

-- Same signature as 20260923120000 (no overload change); the response
-- insert now also reads p_correct. Callers that don't send it get null.
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
      latency_ms, theta_before, p_correct, section_index, session_id
    )
    select
      p_owner_id, r.owner_type, r.item_id, r.context, r.correct, r.chosen_option,
      r.latency_ms, r.theta_before, r.p_correct, r.section_index, p_session_id
    from jsonb_to_recordset(p_responses) as r(
      owner_type text,
      item_id uuid,
      context text,
      correct boolean,
      chosen_option smallint,
      latency_ms integer,
      theta_before double precision,
      p_correct double precision,
      section_index smallint
    )
    join public.questions as q on q.id = r.item_id;
  end if;

  return true;
end;
$$;

revoke execute on function public.commit_exam_section(uuid, text, integer, jsonb, uuid[], uuid[], boolean, uuid, date, text, uuid[], text, jsonb) from public, anon, authenticated;
grant execute on function public.commit_exam_section(uuid, text, integer, jsonb, uuid[], uuid[], boolean, uuid, date, text, uuid[], text, jsonb) to service_role;
