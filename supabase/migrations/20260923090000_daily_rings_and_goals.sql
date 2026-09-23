-- Retention engine, Pillar 2 (Daily Rings): extends activity_log with two
-- accumulating counters instead of adding a parallel per-day table, since
-- activity_log already has the correct grain (one row per user per day).
alter table public.activity_log
  add column if not exists activity_units integer not null default 0,
  add column if not exists review_cleared integer not null default 0;

-- Atomic insert-or-accumulate, same on-conflict pattern as
-- record_wrong_review/record_correct_review (20260922145253): callers pass
-- how much of each counter *this* action contributed, never a running total,
-- so concurrent writes for the same user/day can never clobber each other.
create or replace function public.increment_daily_activity(
  p_user_id text,
  p_activity_date date,
  p_source text,
  p_activity_units integer default 0,
  p_review_cleared integer default 0
)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
begin
  insert into public.activity_log (user_id, activity_date, source, activity_units, review_cleared)
  values (p_user_id, p_activity_date, p_source, p_activity_units, p_review_cleared)
  on conflict (user_id, activity_date) do update set
    activity_units = activity_log.activity_units + excluded.activity_units,
    review_cleared = activity_log.review_cleared + excluded.review_cleared;
end;
$$;

revoke execute on function public.increment_daily_activity(text, date, text, integer, integer) from public, anon, authenticated;
grant execute on function public.increment_daily_activity(text, date, text, integer, integer) to service_role;

-- Personal daily target for Ring A ("today's practice"). Guests get the
-- hardcoded client-side default (15) — same "guests get a sane default,
-- accounts get personalization" pattern as vocab known/favorites.
create table if not exists public.user_goals (
  user_id uuid primary key references auth.users(id) on delete cascade,
  daily_activity_target integer not null default 15,
  updated_at timestamptz not null default now()
);

alter table public.user_goals enable row level security;

create policy "Users can view own goal" on public.user_goals
  for select using (auth.uid() = user_id);
create policy "Users can upsert own goal" on public.user_goals
  for insert with check (auth.uid() = user_id);
create policy "Users can update own goal" on public.user_goals
  for update using (auth.uid() = user_id);

-- Exam-section completion now accumulates one activity unit per section
-- (was a write-once "did anything happen today" insert with do-nothing on
-- conflict) so Ring A reflects how much was actually done today, not just
-- whether anything was.
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
  p_review_owner_type text default null
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

  return true;
end;
$$;

-- Ring B ("smart review") counts a review_queue item as cleared exactly
-- when record_correct_review actually removes it from the queue's
-- "still due" state (extends its interval, or graduates it) — never on a
-- fresh wrong answer or a question that was already outside the queue.
create or replace function public.record_correct_review(
  p_owner_type text,
  p_owner_id text,
  p_question_id uuid,
  p_max_interval_days integer
)
returns table(action text, new_interval integer)
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_current_interval integer;
  v_new_interval integer;
begin
  if p_owner_type = 'user' then
    select interval_days into v_current_interval from public.review_queue
      where user_id = p_owner_id::uuid and question_id = p_question_id
      for update;
  else
    select interval_days into v_current_interval from public.review_queue
      where guest_id = p_owner_id and question_id = p_question_id
      for update;
  end if;

  if v_current_interval is null then
    return query select 'not_in_queue'::text, null::integer;
    return;
  end if;

  insert into public.activity_log (user_id, activity_date, source, review_cleared)
  values (p_owner_id, (now() at time zone 'Asia/Jerusalem')::date, 'review_queue', 1)
  on conflict (user_id, activity_date) do update set
    review_cleared = activity_log.review_cleared + 1;

  -- Graduate only once the word has actually survived a review AT the
  -- cap, not the review that first reaches it (same rule as before).
  if v_current_interval >= p_max_interval_days then
    if p_owner_type = 'user' then
      delete from public.review_queue where user_id = p_owner_id::uuid and question_id = p_question_id;
    else
      delete from public.review_queue where guest_id = p_owner_id and question_id = p_question_id;
    end if;
    return query select 'graduated'::text, null::integer;
    return;
  end if;

  v_new_interval := least(greatest(v_current_interval, 1) * 2, p_max_interval_days);

  if p_owner_type = 'user' then
    update public.review_queue
      set interval_days = v_new_interval,
          next_review_at = now() + (v_new_interval || ' days')::interval,
          last_reviewed_at = now()
      where user_id = p_owner_id::uuid and question_id = p_question_id;
  else
    update public.review_queue
      set interval_days = v_new_interval,
          next_review_at = now() + (v_new_interval || ' days')::interval,
          last_reviewed_at = now()
      where guest_id = p_owner_id and question_id = p_question_id;
  end if;

  return query select 'interval_extended'::text, v_new_interval;
end;
$$;
