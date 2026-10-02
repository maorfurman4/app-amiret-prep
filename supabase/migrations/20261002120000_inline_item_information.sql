-- item_information is evaluated once per candidate row by pick_informative_items
-- (~2,200–2,400 rows per call) and pick_informative_passage (~2,500 rows), and
-- was never inlined into them: the old body had a FROM subquery and a
-- `set search_path` clause, and either one stops Postgres from inlining a SQL
-- function. Every row paid for a full function call (plus a search_path
-- save/restore). Measured on the live restatement pool: 42.2 ms through
-- pick_informative_items vs 5.3 ms with the formula inline.
--
-- The new body is the same 3PL Fisher information as a single expression,
-- with the operations in the same order — checked bit-identical against the
-- old function on every item × 5 θ × 2 a (75,420 values). Selection results
-- cannot change.
--
-- Security: not SECURITY DEFINER, EXECUTE only for postgres/service_role, and
-- the body uses only pg_catalog builtins. A SQL-standard RETURN body is
-- parsed and bound when the function is created, so no caller search_path
-- can redirect it — the old `set search_path = ''` protected nothing here.
-- Supabase's security advisor will still report this function under
-- "function_search_path_mutable" (lint 0011): a false positive for a
-- pre-parsed RETURN body, and any search_path setting would block inlining
-- again. Do not "fix" the lint by adding one back.
--
-- Rollback (the previous definition, from 20260923200000_elo_calibration):
--   create or replace function public.item_information(
--     p_theta double precision, p_a double precision, p_b double precision, p_c double precision
--   )
--   returns double precision
--   language sql
--   immutable
--   set search_path = ''
--   as $$
--     select (p_a * p_a) * ((1 - p) / p) * power((p - p_c) / (1 - p_c), 2)
--     from (select p_c + (1 - p_c) / (1 + exp(-p_a * (p_theta - p_b))) as p) as x;
--   $$;

create or replace function public.item_information(
  p_theta double precision, p_a double precision, p_b double precision, p_c double precision
)
returns double precision
language sql
immutable
parallel safe
return (p_a * p_a)
  * ((1 - (p_c + (1 - p_c) / (1 + pg_catalog.exp(-p_a * (p_theta - p_b)))))
     / (p_c + (1 - p_c) / (1 + pg_catalog.exp(-p_a * (p_theta - p_b)))))
  * pg_catalog.power(((p_c + (1 - p_c) / (1 + pg_catalog.exp(-p_a * (p_theta - p_b)))) - p_c) / (1 - p_c), 2);
