-- Data-driven calibration: item difficulties learned from real answers,
-- information-based item selection, and an exemption probability.
-- The math lives in src/lib/calibration.ts; these functions are its atomic,
-- set-based counterparts (kept formula-identical — see the tests).

-- ── 1. Calibrated difficulty, separate from the authored values ─────────────

-- difficulty_level (1-5) and b stay exactly as authored: the static level
-- the item was written for, and the prior its calibration starts from.
-- b_calibrated is the live, data-driven difficulty the engine uses.
alter table public.questions
  add column if not exists b_calibrated double precision check (b_calibrated between -4 and 4),
  add column if not exists calibration_n integer not null default 0 check (calibration_n >= 0),
  add column if not exists calibrated_at timestamptz;

update public.questions set b_calibrated = b where b_calibrated is null;

comment on column public.questions.b is
  'Authored IRT difficulty (static prior; seeds b_calibrated). Not updated by calibration.';
comment on column public.questions.b_calibrated is
  'Data-driven IRT difficulty, Elo-updated from real answers (calibrate_from_responses). Used by the engine.';
comment on column public.questions.calibration_n is
  'Number of answers that have calibrated b_calibrated (drives the Elo step decay).';

-- Which logged answers have already calibrated their item — one per
-- student per item, and never twice.
alter table public.responses
  add column if not exists calibrated boolean not null default false;

create index if not exists responses_owner_item_calibrated_idx
  on public.responses (owner_type, owner_id, item_id) where calibrated;

-- ── 2. Elo calibration (Pelánek, 2016) ───────────────────────────────────────

-- For each eligible response, atomically:
--   p = c + (1 − c) / (1 + e^(−a(θ − b)))       with the item's CURRENT b
--   b ← clamp(b + K0/(1 + n/N0) · (p − outcome), ±4)
-- Eligible: answered, not already used, from an exam/practice/diagnostic
-- context (a review re-serves a concept the student has seen explained, so
-- it isn't a clean measurement), and the first answer by this student to
-- this item (a student repeating an item can't keep pushing its difficulty).
-- The row lock on the question serializes concurrent updates to one item.
-- Returns how many items were updated. The caller decides which responses
-- are trustworthy enough to pass (known ability, not a rapid guess).
create or replace function public.calibrate_from_responses(
  p_response_ids bigint[],
  p_theta double precision,
  p_a double precision,
  p_k0 double precision,
  p_n0 double precision
)
returns integer
language plpgsql
set search_path = ''
as $$
declare
  r record;
  v_b double precision;
  v_n integer;
  v_c double precision;
  v_p double precision;
  v_updated integer := 0;
begin
  for r in
    select resp.id, resp.owner_id, resp.owner_type, resp.item_id, resp.correct
    from public.responses as resp
    where resp.id = any(p_response_ids)
      and resp.chosen_option is not null
      and not resp.calibrated
      and resp.context in ('exam', 'practice', 'diagnostic')
    order by resp.id
  loop
    if exists (
      select 1 from public.responses as prior
      where prior.owner_type = r.owner_type and prior.owner_id = r.owner_id
        and prior.item_id = r.item_id and prior.calibrated
    ) then
      continue;
    end if;

    select coalesce(q.b_calibrated, q.b), q.calibration_n, coalesce(q.c, 0.25)
      into v_b, v_n, v_c
      from public.questions as q where q.id = r.item_id
      for update;
    if v_b is null then continue; end if;

    v_p := v_c + (1 - v_c) / (1 + exp(-p_a * (p_theta - v_b)));
    v_b := least(4, greatest(-4, v_b + (p_k0 / (1 + v_n / p_n0)) * (v_p - case when r.correct then 1 else 0 end)));

    update public.questions
      set b_calibrated = v_b, calibration_n = v_n + 1, calibrated_at = now()
      where id = r.item_id;
    update public.responses set calibrated = true where id = r.id;
    v_updated := v_updated + 1;
  end loop;
  return v_updated;
end;
$$;

revoke execute on function public.calibrate_from_responses(bigint[], double precision, double precision, double precision, double precision) from public, anon, authenticated;
grant execute on function public.calibrate_from_responses(bigint[], double precision, double precision, double precision, double precision) to service_role;

-- ── 3. Information-based selection ───────────────────────────────────────────

-- 3PL Fisher information at θ for one item (a passed in: the engine's
-- baseline discrimination; b the calibrated difficulty).
create or replace function public.item_information(
  p_theta double precision, p_a double precision, p_b double precision, p_c double precision
)
returns double precision
language sql
immutable
set search_path = ''
as $$
  select (p_a * p_a) * ((1 - p) / p) * power((p - p_c) / (1 - p_c), 2)
  from (select p_c + (1 - p_c) / (1 + exp(-p_a * (p_theta - p_b))) as p) as x;
$$;

-- The `p_needed` most informative active items of a type at θ, with
-- randomesque exposure control (Kingsbury & Zara, 1989): the top pool
-- (ties broken at random, so equal-information items don't always resolve
-- to the same physical rows) is shuffled and `p_needed` drawn from it.
-- Unseen items first; seen ones only if the unseen pool runs short.
create or replace function public.pick_informative_items(
  p_type text,
  p_theta double precision,
  p_a double precision,
  p_needed integer,
  p_user_key text,
  p_exclude uuid[] default '{}'::uuid[],
  p_pool integer default 12
)
returns table (question_id uuid, information double precision)
language sql
volatile
set search_path = ''
as $$
  with scored as (
    select q.id,
           public.item_information(p_theta, p_a, coalesce(q.b_calibrated, q.b), coalesce(q.c, 0.25)) as info,
           exists (select 1 from public.user_question_history h
                   where h.user_key = p_user_key and h.question_id = q.id) as seen
    from public.questions as q
    where q.active and q.type = p_type and q.passage_id is null
      and not (q.id = any(p_exclude))
  ),
  pool as (
    select id, info, seen from scored
    order by seen, info desc, random()
    limit greatest(p_pool, p_needed)
  )
  -- `seen` first again: when fewer unseen items than the pool size exist,
  -- the draw still takes every unseen one before any seen one.
  select id, info from pool order by seen, random() limit p_needed;
$$;

-- The most informative unseen reading passage at θ: information summed over
-- its questions (a passage is served whole), randomesque over the top pool.
create or replace function public.pick_informative_passage(
  p_theta double precision,
  p_a double precision,
  p_user_key text,
  p_exclude uuid[] default '{}'::uuid[],
  p_pool integer default 5
)
returns uuid
language sql
volatile
set search_path = ''
as $$
  with per_passage as (
    select q.passage_id,
           sum(public.item_information(p_theta, p_a, coalesce(q.b_calibrated, q.b), coalesce(q.c, 0.25))) as info,
           count(*) as n
    from public.questions as q
    join public.passages as p on p.id = q.passage_id and p.active
    where q.active and q.type = 'reading_comprehension'
      and not (q.passage_id = any(p_exclude))
    group by q.passage_id
    having count(*) >= 5
  ),
  pool as (
    select pp.passage_id,
           exists (select 1 from public.user_passage_history h
                   where h.user_key = p_user_key and h.passage_id = pp.passage_id) as seen,
           pp.info
    from per_passage as pp
    order by seen, info desc, random()
    limit p_pool
  )
  select passage_id from pool order by seen, random() limit 1;
$$;

revoke execute on function public.item_information(double precision, double precision, double precision, double precision) from public, anon, authenticated;
grant execute on function public.item_information(double precision, double precision, double precision, double precision) to service_role;
revoke execute on function public.pick_informative_items(text, double precision, double precision, integer, text, uuid[], integer) from public, anon, authenticated;
grant execute on function public.pick_informative_items(text, double precision, double precision, integer, text, uuid[], integer) to service_role;
revoke execute on function public.pick_informative_passage(double precision, double precision, text, uuid[], integer) from public, anon, authenticated;
grant execute on function public.pick_informative_passage(double precision, double precision, text, uuid[], integer) to service_role;

-- ── 4. Exemption probability on each exam ────────────────────────────────────

alter table public.exam_sessions
  add column if not exists theta_se double precision check (theta_se > 0),
  add column if not exists p_exempt double precision check (p_exempt between 0 and 1);

comment on column public.exam_sessions.p_exempt is
  'P(true θ ≥ cut) from θ̂ and its standard error, on the app''s own scale (see src/lib/calibration.ts scale note).';

-- Same signature as before; the completion update now also writes
-- theta_se and p_exempt when the payload carries them.
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
    theta_se = case when p_update ? 'theta_se' then (p_update->>'theta_se')::double precision else session.theta_se end,
    p_exempt = case when p_update ? 'p_exempt' then (p_update->>'p_exempt')::double precision else session.p_exempt end,
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
