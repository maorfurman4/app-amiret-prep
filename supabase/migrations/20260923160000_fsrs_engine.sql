-- Pillar 3: skill-based spaced repetition on an FSRS model.
--
-- 1. Every question is tagged with the concept it actually tests
--    (skill + target_lemma), and a derived concept_key groups items that
--    test the same thing — the unit the scheduler now works in.
-- 2. srs_cards replaces review_queue's per-question interval doubling with
--    one FSRS memory state (stability / difficulty) per owner per concept.
--    The FSRS math itself lives in the app (src/lib/fsrs.ts); the DB only
--    stores state and picks sibling questions.
-- 3. user_goals.exam_date lets the scheduler compress toward the test.
--
-- review_queue and its RPCs are deliberately left in place (not written by
-- the new code) so the previous deployment keeps working until the new one
-- is live; srs_import_legacy_review_queue() re-imports anything it wrote in
-- that window and can be re-run safely.

-- ── 1. Concept tagging ───────────────────────────────────────────────────────

alter table public.questions
  add column if not exists skill text,
  add column if not exists target_lemma text;

-- Heuristic, deterministic first-pass taxonomy (see the per-type comments).
-- It is a baseline to be refined, not a claim of linguistic precision:
-- target_lemma is the surface form (no lemmatizer), and restatements with
-- no logical connector fall back to 'rst.general', which is scheduled per
-- item because "general paraphrase" is not a concept two items share.
create or replace function public.classify_question(
  p_type text,
  p_text text,
  p_options jsonb,
  p_correct_answer integer
)
returns table (skill text, target_lemma text)
language plpgsql
stable
set search_path = ''
as $$
declare
  v_text text := lower(coalesce(p_text, ''));
  v_answer text;
  v_match text;
begin
  if p_type = 'sentence_completion' then
    -- The concept is the word the blank requires: the correct option.
    v_answer := nullif(lower(btrim(p_options -> p_correct_answer ->> 'text')), '');
    if v_answer is not null and exists (
      select 1 from public.vocabulary v
      where lower(btrim(v.word)) = v_answer and v.category = 'connectors'
    ) then
      return query select 'sc.connector'::text, v_answer;
    else
      return query select 'sc.vocab'::text, v_answer;
    end if;
    return;

  elsif p_type = 'restatement' then
    -- The concept is the logical relation the sentence hinges on, keyed by
    -- its connector. Families are tried in priority order; within one, the
    -- earliest connector in the sentence wins.
    v_match := substring(v_text from '\m(unless|provided that|providing that|as long as|only if|even if|if|otherwise|in case)\M');
    if v_match is not null then return query select 'rst.condition'::text, v_match; return; end if;

    v_match := substring(v_text from '\m(although|even though|though|whereas|despite|in spite of|nevertheless|nonetheless|however|notwithstanding|rather than|instead of|unlike|while|but|yet)\M');
    if v_match is not null then return query select 'rst.contrast'::text, v_match; return; end if;

    v_match := substring(v_text from '\m(because of|because|due to|owing to|thanks to|as a result of|as a result|consequently|therefore|thus|hence|so that|since)\M');
    if v_match is not null then return query select 'rst.cause'::text, v_match; return; end if;

    v_match := substring(v_text from '\m(more than|less than|fewer than|rather|than|as [a-z]+ as|similar to|compared to|compared with|the same as)\M');
    if v_match is not null then
      -- "as fast as" / "as big as" are one pattern, not one concept each.
      if v_match ~ '^as [a-z]+ as$' then v_match := 'as ... as'; end if;
      return query select 'rst.comparison'::text, v_match; return;
    end if;

    v_match := substring(v_text from '\m(as soon as|by the time|no sooner|until|before|after|once|whenever|when)\M');
    if v_match is not null then return query select 'rst.time'::text, v_match; return; end if;

    v_match := substring(v_text from '\m(hardly|scarcely|rarely|seldom|barely|never|neither|nor|little|few|not|no)\M');
    if v_match is not null then return query select 'rst.negation'::text, v_match; return; end if;

    return query select 'rst.general'::text, null::text;
    return;

  elsif p_type = 'reading_comprehension' then
    -- The concept is the comprehension skill the stem asks for; only
    -- vocabulary-in-context carries a lemma (the quoted word).
    if v_text ~ '\m(the word|the phrase|the term|closest in meaning|most closely means|refers to)\M' then
      v_match := lower(substring(p_text from '["“''‘]([A-Za-z][A-Za-z -]*?)["”''’]'));
      return query select 'rc.vocab_in_context'::text, v_match; return;
    end if;
    if v_text ~ '\m(main|mainly|primary|primarily|best title|mostly about|central idea|central claim|central argument)\M' then
      return query select 'rc.main_idea'::text, null::text; return;
    end if;
    if v_text ~ '\m(in order to|purpose of|why does the author|why does the passage|function of)\M' then
      return query select 'rc.author_purpose'::text, null::text; return;
    end if;
    if v_text ~ '\m(attitude|tone)\M' then
      return query select 'rc.attitude'::text, null::text; return;
    end if;
    if v_text ~ '\m(infer|inferred|inference|implies|imply|implied|implication|suggest|suggests|suggested|most likely|probably|conclude|concluded|conclusion|broader)\M' then
      return query select 'rc.inference'::text, null::text; return;
    end if;
    return query select 'rc.detail'::text, null::text;
    return;
  end if;

  return query select null::text, null::text;
end;
$$;

revoke execute on function public.classify_question(text, text, jsonb, integer) from public, anon, authenticated;
grant execute on function public.classify_question(text, text, jsonb, integer) to service_role;

-- The scheduling unit. Lemma-bearing items group by skill+lemma; skill-only
-- items group by skill; unclassifiable or 'rst.general' items stand alone.
alter table public.questions
  add column if not exists concept_key text generated always as (
    case
      when skill is null then 'item/' || id::text
      when target_lemma is not null then skill || '/' || target_lemma
      when skill = 'rst.general' then 'item/' || id::text
      else skill
    end
  ) stored;

create index if not exists questions_concept_key_active_idx
  on public.questions (concept_key) where active;

-- Keep tags current: new rows are classified unless inserted pre-tagged;
-- edits to the content a tag is derived from re-derive it.
create or replace function public.questions_classify_trigger()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  v_skill text;
  v_lemma text;
begin
  if tg_op = 'INSERT' and new.skill is not null then
    return new;
  end if;
  select c.skill, c.target_lemma into v_skill, v_lemma
    from public.classify_question(new.type, new.text, new.options, new.correct_answer) as c;
  new.skill := v_skill;
  new.target_lemma := v_lemma;
  return new;
end;
$$;

drop trigger if exists questions_classify on public.questions;
create trigger questions_classify
  before insert or update of type, text, options, correct_answer on public.questions
  for each row execute function public.questions_classify_trigger();

-- Backfill the existing bank (idempotent: only untagged rows).
-- (Only skill/target_lemma change here, so the trigger above doesn't fire.)
update public.questions as q
set (skill, target_lemma) = (
  select c.skill, c.target_lemma
  from public.classify_question(q.type, q.text, q.options, q.correct_answer) as c
)
where q.skill is null;

-- ── 2. Exam date ─────────────────────────────────────────────────────────────

alter table public.user_goals
  add column if not exists exam_date date;

-- ── 3. FSRS cards ────────────────────────────────────────────────────────────

create table if not exists public.srs_cards (
  id bigint generated always as identity primary key,
  owner_id text not null,
  owner_type text not null check (owner_type in ('user', 'guest')),
  concept_key text not null,
  item_type text not null,
  skill text,
  target_lemma text,
  -- The question that created the card: the fallback when no sibling
  -- question for the concept is available.
  anchor_question_id uuid not null references public.questions(id) on delete cascade,
  -- FSRS memory state. stability = days until retrievability falls to 90%.
  stability double precision not null check (stability > 0),
  difficulty double precision not null check (difficulty between 1 and 10),
  reps integer not null default 0 check (reps >= 0),
  lapses integer not null default 0 check (lapses >= 0),
  last_review_at timestamptz not null,
  due_at timestamptz not null,
  -- Optimistic-concurrency token: every state write is compare-and-swap.
  version integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (owner_type, owner_id, concept_key)
);

create index if not exists srs_cards_owner_due_idx
  on public.srs_cards (owner_id, due_at);

alter table public.srs_cards enable row level security;
revoke all on table public.srs_cards from anon, authenticated;

comment on table public.srs_cards is
  'FSRS memory state per owner per concept (questions.concept_key). Scheduling math: src/lib/fsrs.ts.';

-- One sibling per concept: a random active question testing the same
-- concept, excluding the ones passed in (anchors and recently answered
-- items). Concepts with no eligible sibling are simply absent — the caller
-- falls back to the card's anchor question.
create or replace function public.srs_pick_siblings(
  p_concept_keys text[],
  p_exclude_question_ids uuid[] default '{}'::uuid[]
)
returns table (concept_key text, question_id uuid)
language sql
volatile
set search_path = ''
as $$
  select distinct on (q.concept_key) q.concept_key, q.id
  from public.questions as q
  where q.active
    and q.concept_key = any(p_concept_keys)
    and not (q.id = any(p_exclude_question_ids))
  order by q.concept_key, random();
$$;

revoke execute on function public.srs_pick_siblings(text[], uuid[]) from public, anon, authenticated;
grant execute on function public.srs_pick_siblings(text[], uuid[]) to service_role;

-- ── 4. Legacy import ─────────────────────────────────────────────────────────

-- Converts review_queue rows into FSRS cards. Several legacy rows can map
-- to one concept; the earliest-due one seeds the card. Initial state:
-- a row still at interval 1 was last seen as a failure, so it starts at
-- FSRS-4.5's first-lapse stability (w0 = 0.4872 d); a row that had already
-- earned a longer interval keeps that interval as its stability.
-- Difficulty starts at D0(Again) = w4 + 2·w5 = 7.6214 (same constants as
-- src/lib/fsrs.ts). Existing due dates are preserved. Re-runnable: rows
-- whose concept already has a card are skipped.
create or replace function public.srs_import_legacy_review_queue()
returns integer
language plpgsql
set search_path = ''
as $$
declare
  v_inserted integer;
begin
  insert into public.srs_cards (
    owner_id, owner_type, concept_key, item_type, skill, target_lemma,
    anchor_question_id, stability, difficulty, reps, lapses, last_review_at, due_at
  )
  select distinct on (legacy.owner_type, legacy.owner_id, q.concept_key)
    legacy.owner_id, legacy.owner_type, q.concept_key, q.type, q.skill, q.target_lemma,
    q.id,
    case when rq.interval_days > 1 then rq.interval_days::double precision else 0.4872 end,
    7.6214,
    rq.times_wrong,
    rq.times_wrong,
    coalesce(rq.last_reviewed_at, rq.created_at, now()),
    rq.next_review_at
  from public.review_queue as rq
  cross join lateral (
    select
      case when rq.user_id is not null then 'user' else 'guest' end as owner_type,
      coalesce(rq.user_id::text, rq.guest_id) as owner_id
  ) as legacy
  join public.questions as q on q.id = rq.question_id
  where legacy.owner_id is not null
  order by legacy.owner_type, legacy.owner_id, q.concept_key, rq.next_review_at asc
  on conflict (owner_type, owner_id, concept_key) do nothing;

  get diagnostics v_inserted = row_count;
  return v_inserted;
end;
$$;

revoke execute on function public.srs_import_legacy_review_queue() from public, anon, authenticated;
grant execute on function public.srs_import_legacy_review_queue() to service_role;

select public.srs_import_legacy_review_queue();
