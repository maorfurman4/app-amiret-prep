-- Closes a TOCTOU race in the review_queue write paths: both the
-- wrong-answer path (src/lib/review-queue.ts) and the correct-answer
-- interval-doubling path (POST /api/review-queue) previously did a plain
-- SELECT-then-INSERT/UPDATE from application code with no row lock, so two
-- concurrent submissions for the same (owner, question) could interleave
-- and silently lose one write (its own INSERT/UPDATE error was never even
-- checked). Both writes now happen atomically inside Postgres.

-- Wrong answer: insert-or-increment, identical logic to the guest/user
-- branches already used by commit_exam_section's wrong-answer loop —
-- Postgres's ON CONFLICT DO UPDATE is itself atomic, no read step needed.
create or replace function public.record_wrong_review(
  p_owner_type text,
  p_owner_id text,
  p_question_id uuid
)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if p_owner_type = 'user' then
    insert into public.review_queue (user_id, question_id, times_wrong, next_review_at, last_reviewed_at, interval_days)
    values (p_owner_id::uuid, p_question_id, 1, now(), now(), 1)
    on conflict (user_id, question_id) where user_id is not null do update set
      times_wrong = public.review_queue.times_wrong + 1,
      next_review_at = now(),
      last_reviewed_at = now(),
      interval_days = 1;
  elsif p_owner_type = 'guest' then
    insert into public.review_queue (guest_id, question_id, times_wrong, next_review_at, last_reviewed_at, interval_days)
    values (p_owner_id, p_question_id, 1, now(), now(), 1)
    on conflict (guest_id, question_id) do update set
      times_wrong = public.review_queue.times_wrong + 1,
      next_review_at = now(),
      last_reviewed_at = now(),
      interval_days = 1;
  end if;
end;
$$;

revoke execute on function public.record_wrong_review(text, text, uuid) from public, anon, authenticated;
grant execute on function public.record_wrong_review(text, text, uuid) to service_role;

-- Correct answer: read-and-double (or graduate) the existing row's
-- interval, locked with `for update` so a concurrent call for the same
-- row blocks until this transaction commits, then re-reads the value this
-- write just set — the same doubling/graduation policy
-- src/app/api/review-queue/route.ts already implements, just made atomic.
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

revoke execute on function public.record_correct_review(text, text, uuid, integer) from public, anon, authenticated;
grant execute on function public.record_correct_review(text, text, uuid, integer) to service_role;
