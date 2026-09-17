-- Commit one exam section and all of its durable side effects in one transaction.
-- The conditional UPDATE locks the session row; concurrent submissions return
-- false before any history, activity, or review-queue writes can run.
create unique index if not exists review_queue_user_id_question_id_key
  on public.review_queue (user_id, question_id)
  where user_id is not null;

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
    insert into public.activity_log (user_id, activity_date, source)
    values (p_owner_id, p_activity_date, p_activity_source)
    on conflict (user_id, activity_date) do nothing;
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

revoke execute on function public.commit_exam_section(uuid, text, integer, jsonb, uuid[], uuid[], boolean, uuid, date, text, uuid[], text) from public, anon, authenticated;
grant execute on function public.commit_exam_section(uuid, text, integer, jsonb, uuid[], uuid[], boolean, uuid, date, text, uuid[], text) to service_role;
