-- Calibration audit: compares empirical accuracy (real completed exams) against
-- the 3PL-predicted accuracy for the same items, using the examinee's theta at
-- the time each section was served (theta_history[after_section = N-1], 0 for
-- section 1's initial state).
--
-- Run via Supabase SQL editor / MCP execute_sql. Re-run periodically as more
-- real (non-practice) completed exams accumulate — see the "n" column for
-- sample size per bucket. Per-question rows need n >= 15-20 before treating
-- emp_p as reliable; at n=3-6 a single flipped answer swings emp_p by 20-33pp.
--
-- Query 1: population-level calibration by question type x difficulty level.
with sessions as (
  select id, questions_by_section, answers_by_section, theta_history
  from exam_sessions
  where completed_at is not null and coalesce(is_practice, false) = false
),
theta_map as (
  select s.id as session_id, (t->>'after_section')::int as after_section, (t->>'theta')::float as theta
  from sessions s, jsonb_array_elements(s.theta_history) as t
),
secs as (
  select s.id as session_id, sec.key as section_key, sec.value as qarr, s.answers_by_section->sec.key as ans_arr
  from sessions s, jsonb_each(s.questions_by_section) as sec(key, value)
),
items as (
  select session_id, section_key::int as section_num,
    (row_number() over (partition by session_id, section_key order by ord) - 1)::int as idx0,
    q.value as qval,
    ans_arr
  from secs, jsonb_array_elements(qarr) with ordinality as q(value, ord)
),
scored as (
  select
    i.session_id, i.section_num,
    (i.qval->>'id') as question_id,
    (i.qval->>'type') as qtype,
    (i.qval->>'difficulty_level')::int as difficulty_level,
    (i.qval->>'a')::float as a,
    (i.qval->>'b')::float as b,
    (i.qval->>'c')::float as c,
    (i.qval->>'correct_answer')::int as correct_answer,
    nullif(i.ans_arr->>i.idx0, 'null')::int as given_answer,
    coalesce(tm.theta, 0) as theta
  from items i
  left join theta_map tm on tm.session_id = i.session_id and tm.after_section = i.section_num - 1
)
select
  qtype, difficulty_level,
  count(*) as n,
  round(avg(case when given_answer = correct_answer then 1.0 else 0.0 end)::numeric, 3) as emp_p,
  round(avg(c + (1-c) / (1 + exp(-1.7*a*(theta-b))))::numeric, 3) as pred_p
from scored
where given_answer is not null
group by qtype, difficulty_level
order by qtype, difficulty_level;

-- Query 2: worst-fitting individual items (n >= 3 minimum; treat with caution
-- below n=15). Swap the outer query for this block to inspect specific items.
-- select question_id, qtype, difficulty_level, round(b::numeric,2) as b, count(*) as n,
--   round(avg(case when given_answer = correct_answer then 1.0 else 0.0 end)::numeric, 2) as emp_p,
--   round(avg(c + (1-c) / (1 + exp(-1.7*a*(theta-b))))::numeric, 2) as pred_p
-- from scored
-- where given_answer is not null
-- group by question_id, qtype, difficulty_level, b, c
-- having count(*) >= 3
-- order by abs(avg(case when given_answer = correct_answer then 1.0 else 0.0 end) - avg(c + (1-c) / (1 + exp(-1.7*a*(theta-b))))) desc
-- limit 15;
