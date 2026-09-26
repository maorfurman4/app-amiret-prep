-- Exam level accuracy (fixes 2 and 3 of the level audit).
--
-- 1. questions.exam_eligible: an item whose authored level label contradicts
--    its authored difficulty (b) cannot be trusted to measure ability until
--    real answers calibrate it. Such items stay in practice (which only uses
--    the label) but are left out of the adaptive exam and the diagnostic.
--    Default true: nothing changes until an item is marked.
--
-- 2. pick_informative_items: same selection, restricted to exam-eligible
--    items.
--
-- 3. pick_informative_passage: the randomesque draw among the most
--    informative passages could land one level below where the student was
--    routed (passage difficulties come in coarse clusters). Among passages
--    giving at least 95% of the best available information, a passage at
--    the routed level is now preferred; if there is none, the draw is exactly
--    as before. Information loss is capped at 5% by construction.
--
-- Signatures, security and grants are unchanged.

alter table public.questions
  add column if not exists exam_eligible boolean not null default true;

comment on column public.questions.exam_eligible is
  'False when the authored level label contradicts the authored difficulty (b): kept for practice, excluded from adaptive measurement until calibrated.';

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
    where q.active and q.exam_eligible and q.type = p_type and q.passage_id is null
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
           p.difficulty_level as lvl,
           sum(public.item_information(p_theta, p_a, coalesce(q.b_calibrated, q.b), coalesce(q.c, 0.25))) as info,
           count(*) as n
    from public.questions as q
    join public.passages as p on p.id = q.passage_id and p.active
    where q.active and q.exam_eligible and q.type = 'reading_comprehension'
      and not (q.passage_id = any(p_exclude))
    group by q.passage_id, p.difficulty_level
    having count(*) >= 5
  ),
  marked as (
    select pp.*,
           exists (select 1 from public.user_passage_history h
                   where h.user_key = p_user_key and h.passage_id = pp.passage_id) as seen
    from per_passage as pp
  ),
  -- Unseen passages when any exist, otherwise all (same priority as before).
  candidates as (
    select * from marked
    where not seen or not exists (select 1 from marked m where not m.seen)
  ),
  routed as (
    -- The level the student is routed to (src/lib/adaptive.ts routeNextDifficulty).
    select case when p_theta >= 1.5 then 5 when p_theta >= 0.5 then 4
                when p_theta >= -0.5 then 3 when p_theta >= -1.5 then 2 else 1 end as lvl
  ),
  preferred as (
    select c.* from candidates c, routed r
    where c.lvl = r.lvl and c.info >= 0.95 * (select max(info) from candidates)
  ),
  pool as (
    -- Routed-level passages near the best when there are any; otherwise the
    -- top of all candidates, exactly as before.
    select passage_id from (
      select passage_id, info from preferred
      union all
      select passage_id, info from candidates where not exists (select 1 from preferred)
    ) x
    order by info desc, random()
    limit p_pool
  )
  select passage_id from pool order by random() limit 1;
$$;

revoke execute on function public.pick_informative_items(text, double precision, double precision, integer, text, uuid[], integer) from public, anon, authenticated;
grant execute on function public.pick_informative_items(text, double precision, double precision, integer, text, uuid[], integer) to service_role;
revoke execute on function public.pick_informative_passage(double precision, double precision, text, uuid[], integer) from public, anon, authenticated;
grant execute on function public.pick_informative_passage(double precision, double precision, text, uuid[], integer) to service_role;
