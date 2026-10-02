# AUDIT — amiret-prep (AMIRNET exam prep)

Date: 2026-09-30 · Worktree `bold-allen-bec1d6` at `ec18fbe` (= origin/main) · Read-only audit: no code or data was changed.

Method: three independent read-only reviewers (architecture, test fidelity, quality & safety) ran as separate Explore agents with no write tools; the orchestrator merged them, re-read the key code paths for the top findings, and checked one claim against the live database (read-only SELECT on `pg_proc`). No skill was loaded (none of the available skills fits a whole-repo audit better than direct review). Paths are relative to the repo root.

---

## 1. Executive summary

The app is a real computer-adaptive test, not a fixed question set: after every section it re-estimates ability (3PL IRT, MLE/EAP) and picks the next section's items by Fisher information, with a server-enforced section timer and an atomic, race-safe section commit. The six scored sections match NITE's AMIRNET structure one-to-one (order, counts, times). The weak points are integrity and trust boundaries rather than the engine: public endpoints let anyone learn answer keys or shift item difficulty, and practice exams feed the public leaderboard.

**Top strengths**
1. Adaptive engine with auditable routing (θ trail + routing reason stored per section) — `src/app/api/exam/answer/route.ts:123-172`, `src/lib/calibration.ts:54-79`.
2. Atomic section commit with a conditional UPDATE; a double submit loses cleanly with 409 — `supabase/migrations/20260923200000_elo_calibration.sql:237-252`, `src/app/api/exam/answer/route.ts:287-316`.
3. Structure matches NITE exactly for sections 1–6 — `src/types/exam.ts:61-67`.

**Top risks**
1. Anyone (unlimited free guest identities) can push any item's calibrated difficulty to the ±4 cap, which then scores every real student — `src/app/api/responses/route.ts:64-90`.
2. Answer keys are obtainable during a live exam (diagnostic endpoint as an oracle; open practice endpoint), defeating the answer stripping in `/api/exam/state` — `src/app/api/diagnostic/next/route.ts:62-80`.
3. Practice exams (answers visible) are counted in `user_stats` and the public leaderboard — confirmed on the live trigger.

---

## 2. Architecture map

**Stack (from files):** Next.js 16.2.9 / React 19.2.4, App Router, webpack build (`package.json:6-7,24,28-29`); Supabase (supabase-js ^2.108, @supabase/ssr) — all server queries use the service-role client (`src/lib/supabase-server.ts:11-18,63-71`); identity = Supabase Bearer token or HMAC-signed HttpOnly guest cookie `amiret_guest_v1` (`src/lib/guest-token.ts:3,12-31`); Next 16 `proxy.ts` rate limiting via Upstash (120/min per actor, 600/min per IP, fails open) (`src/proxy.ts:36-38,96-131`); OpenAI gpt-4o only in the admin generator (`src/lib/ai.ts:5-7,94-100`); zod 4, Tailwind 4, PWA with `/api/*` NetworkOnly (`next.config.ts:4-23`); Vitest 4 (node env, 54 test files) (`vitest.config.ts:4-12`); CI = vitest + build (`.github/workflows/ci.yml`); Vercel region bom1 + daily keep-alive cron (`vercel.json`).

**Module map (src/):**
- `app/exam/page.tsx` (mode picker), `app/exam/[sessionId]/page.tsx` (live exam), `app/results/[sessionId]`, `app/review/[sessionId]` — all client components.
- `app/api/exam/{start,answer,state,results,review}` — exam lifecycle; `app/api/{practice,diagnostic,responses,review-queue,today-session}` — non-exam serving/logging; `app/api/{stats,streak,dashboard-summary,goals,my-words,official-score,profile}` — user data; `app/api/{questions/generate,admin/check,cron/keep-alive}` — ops.
- `lib/` psychometrics: `adaptive.ts`, `calibration.ts`, `calibration-server.ts`, `item-selection.ts`, `routed-level.ts`, `ability.ts`, `exemption.ts`; sourcing: `question-history.ts`, `option-overlap.ts`, `option-shuffle.ts`; SRS: `fsrs.ts`, `srs.ts`; identity: `supabase*.ts`, `auth-fetch.ts`, `guest*.ts`.
- `types/exam.ts` — `SECTION_CONFIGS` (7 sections), `isCorrectAnswer`, `classifyScore`.

**Data model:** `questions` (type, options jsonb, correct_answer, a/b/c, `b_calibrated`, `exam_eligible`, `skill`, `concept_key`), `passages`, `exam_sessions` (theta, theta_history, theta_final, theta_se, p_exempt, score, questions_by_section, section_results, used_question_ids/used_passage_ids), `responses` (one row per answer, service-role only), `srs_cards`, `srs_review_log`, `user_goals`, `official_scores` (+ service-role view `official_score_linking`), `user_stats`/`leaderboard` (maintained by trigger). SQL functions are revoked from anon/authenticated and granted to service_role only (`commit_exam_section`, `pick_informative_items/_passage`, `calibrate_from_responses`, …). **Gap:** `user_question_history`, `user_passage_history`, `activity_log`, `review_queue`, `vocabulary`, `user_vocab_*` have no `CREATE TABLE` in the repo, and `supabase-schema.sql` contradicts the live schema (e.g. `exam_sessions.user_id` FK to `auth.users` while guest UUIDs are inserted, `src/app/api/exam/start/route.ts:32,69`).

**Exam flow:**
1. **Start** — `POST /api/exam/start`: section 1 = 4 most-informative items at θ=0 (`start/route.ts:44-50`, `routed-level.ts:5`); session row with expiry now+240 s (null in practice) (`:64-92`).
2. **Serve** — `GET /api/exam/state` returns the current section only; in real mode strips `correct_answer`, explanation, hint, skill (`state/route.ts:34-53`); returns server time for clock-skew correction.
3. **Answer** — `POST /api/exam/answer`: zod body (`:29-52`), ownership + section-index checks (`:57-90`), late submit (>20 s past expiry) = all blanks (`:106-110`); cumulative MLE θ (`:113-123`), EAP routing θ + SE (`:129-132`), `chooseRouteTarget` (`:159`); next section via `pick_informative_items` / `pick_informative_passage` with already-shown answer words avoided (`:228-252`).
4. **Score** (last section) — base θ from sections 1–6; score = max(base, min(score incl. 7, base+2)) (`:186-216`); θ→score = θ·20+100 clamped 50–150 (`adaptive.ts:190-194`); P(exempt) = Φ((θ−1.7)/SE) (`calibration.ts:96-99`).
5. **Commit** — RPC `commit_exam_section` in one transaction: conditional UPDATE, seen-history, activity, responses (`elo_calibration.sql:212-342`); after completion: FSRS update and Elo item calibration (`answer/route.ts:324-356`).
6. **Results** — `GET /api/exam/results` (owner-filtered; 403 while a real exam is unfinished) (`results/route.ts:19-34`); page derives interval, per-type accuracy, routed level, pacing (`results/[sessionId]/page.tsx:81-105,224,263-286`).

**Rendering & state:** exam path is fully client-side (`'use client'`), data via `authFetch` → route handlers; no server actions. Exam page state is local (`useState`/`useRef`), answers mirrored to a localStorage draft (`exam/[sessionId]/page.tsx:57-65,139-150`), submit guarded by a ref, 429 retry with backoff, 409 resync (`:173-244`).

---

## 3. AMIRNET fidelity

Sources: (a) the spec in the audit request; (b) NITE's official AMIRNET presentation (nite.org.il, 2024), read directly. They disagree in places: (a) mixes Amiram (≈60 min, ≈8 SC + ≈8 restatement) with Amirnet; (b) is authoritative for Amirnet.

| # | Attribute | Official | This app | Status | file:line |
|---|---|---|---|---|---|
| 1 | Item types | SC, restatement, RC | Same three (plus unused `esra`) | MATCH | `src/types/exam.ts:1,61-69` |
| 2 | Section order 1–6 | SC, SC, RC, Rest, Rest, SC | Identical | MATCH | `src/types/exam.ts:62-67` |
| 3 | Questions per section | 4,4,5,3,3,4 | 4,4,5,3,3,4 (RC = one passage, ≥5 eligible questions) | MATCH | `src/types/exam.ts:62-67`; `…exam_level_accuracy.sql:81` |
| 4 | Section durations | 4,4,15,6,6,4 min | 240,240,900,360,360,240 s | MATCH | `src/types/exam.ts:62-67` |
| 5 | Number of sections | 8 (6 scored + 2 experimental) | 7 (6 + 1) | DIFFER | `src/types/exam.ts:68` |
| 6 | Experimental item types | New types: listening, listening continuation, grammar in context, word formation, or one writing task | 4 sentence-completion items; UI states the new types are not simulated | DIFFER | `src/types/exam.ts:68`; `src/app/exam/page.tsx:16` |
| 7 | Experimental scoring | Correct answers add ≤2; wrong never lowers | Implemented; stored θ/P(exempt) inconsistent with the capped score (see §5 M1) | MATCH (rule) | `src/app/api/exam/answer/route.ts:188-216` |
| 8 | Total time | ≤50 min (Amirnet); ≈60 (Amiram, per spec a) | 43 min scored + 4 experimental = 47 | MATCH (Amirnet) / DIFFER (Amiram — no mode) | computed from `src/types/exam.ts:62-68` |
| 9 | **Adaptivity** | Between sections; level estimated after each | Real: θ re-estimated after every section, next section chosen by information at the routed target; sections ≥5 aim at the exemption cut when uncertain | MATCH | `answer/route.ts:123-159,228-252`; `calibration.ts:54-79` |
| 10 | Precision of targeting | — | Selection draws ~4 of the top 80 items by information in random order (`CANDIDATE_FACTOR=20`); documented `RANDOMESQUE_FACTOR=3` is unused | DIFFER from own design | `src/lib/item-selection.ts:17-22,38-54`; `…exam_level_accuracy.sql:49-56` |
| 11 | Starting difficulty | Moderate (spec a) | θ=0 = level 3 | MATCH | `src/lib/routed-level.ts:5`; `start/route.ts:44-50` |
| 12 | Score scale | ~50–150 | θ·20+100, clamped 50–150; mapping not yet linked to NITE scores | MATCH (range) / UNVERIFIED (formula) | `src/lib/adaptive.ts:190-194`; `src/lib/calibration.ts:7-20` |
| 13 | Unanswered = wrong | Yes | null → 0 | MATCH | `src/lib/adaptive.ts:209`; `src/types/exam.ts:76-78` |
| 14 | No guessing penalty | Yes | 3PL, c=0.25, no deduction; UI encourages guessing | MATCH | `src/lib/adaptive.ts:17,42-44` |
| 15 | On-screen section timer | Yes | Countdown to server expiry, skew-corrected, auto-submit at 0 | MATCH | `src/components/exam/ExamTimer.tsx:14-60`; `src/lib/use-countdown.ts:33-69` |
| 16 | Timer enforced | Hard section time | Server expiry per section; >20 s late = all answers blank | MATCH / UNVERIFIED (late rule is the app's own) | `answer/route.ts:106-110` |
| 17 | One question at a time | Yes (spec a) | One question per screen; RC passage shown with each question | MATCH | `src/app/exam/[sessionId]/page.tsx:423-431`; `src/components/exam/QuestionCard.tsx:80-91` |
| 18 | Back-navigation within section | Allowed until time ends; answers changeable | Prev/Next + question dots; answers changeable in real mode | MATCH | `src/app/exam/[sessionId]/page.tsx:139-150,251-261,449-475` |
| 19 | Back to earlier sections | Not allowed | Not possible (409 on section mismatch) | MATCH | `answer/route.ts:80-90` |
| 20 | Flag Question | Exists | Absent (pace hint even says "סמן") | DIFFER | `src/components/exam/PaceGauge.tsx:26` |
| 21 | Ending a section early | Not stated | Real mode blocks finishing with blanks | UNVERIFIED | `src/app/exam/[sessionId]/page.tsx:263-276` |
| 22 | Scores equated across paths | Yes | Common IRT scale across paths; item difficulties mostly authored, not measured (≈30 of 7,428 calibrated) | UNVERIFIED | `src/lib/adaptive.ts:28-34` |

**Verdict:** very close to the real Amirnet for the six scored sections — structure, timing, adaptivity, navigation and scoring rules all match. Biggest gaps: (1) one experimental section of an old item type instead of two sections of new item types; (2) no Flag Question; (3) the θ→score mapping and item difficulties are not yet anchored to NITE data, so the score is internally consistent but its absolute value is unproven; (4) targeting is looser than designed (random among top 80).

---

## 4. What's excellent

- **Race-safe atomic commit** — conditional UPDATE on `current_section_index` + all side effects in one transaction; the client resyncs on 409 — `supabase/migrations/20260923200000_elo_calibration.sql:237-252`; `src/app/exam/[sessionId]/page.tsx:212-219`.
- **Server-side grading only** — clients never report correctness; diagnostic re-scores against stored parameters — `src/lib/responses.ts:122-140`.
- **Answer secrecy during a real exam** (as served by the exam API) — `src/app/api/exam/state/route.ts:34-53`.
- **Signed guest identity** — HMAC cookie with `timingSafeEqual`; an invalid Bearer disables the guest fallback — `src/lib/guest-token.ts:19-28`; `src/lib/supabase-server.ts:29-39`.
- **DB hardening** — `search_path=''`, revokes from anon/authenticated, `security_invoker` views — e.g. `supabase/migrations/20260924090000_official_scores.sql:40-41,53-74`.
- **Timer robustness** — wall-clock countdown with skew correction and refocus handling, plus a server grace period — `src/lib/use-countdown.ts:48-59`; `src/app/api/exam/answer/route.ts:106-110`.
- **Hebrew/English bidi** — English runs wrapped in `<bdi dir="ltr">`; questions/options `dir="ltr" lang="en"` inside RTL — `src/components/RichText.tsx:6-23`; `src/components/exam/QuestionCard.tsx:80-113`.
- **Auditable routing** — each section's θ, SE, target and reason stored in `theta_history` — `src/app/api/exam/answer/route.ts:163-172`.
- **No repeated answer choices within an exam** — `src/lib/option-overlap.ts:36-54`, tested (`option-overlap.test.ts`).

---

## 5. What's broken / fragile

| ID | Severity | Finding | Failure scenario | file:line |
|---|---|---|---|---|
| H1 | **High** | Item difficulty can be manipulated by anyone | `/api/responses` accepts any item id, a client-chosen answer and latency; each new guest (free via `/api/auth/guest`) contributes one calibrating answer per item. ~85 scripted guests push an item's `b_calibrated` to +4, which then scores every real student and changes selection. | `src/app/api/responses/route.ts:15-26,64-90`; `src/lib/calibration-server.ts:32-44`; `…elo_calibration.sql:48-93` |
| H2 | **High** | Answer key obtainable mid-exam | `POST /api/diagnostic/next` with a live exam item id and `chosen:0` returns θ>0 iff option 0 is correct (≤3 calls/item). `GET /api/practice/questions` (no auth) returns full rows with `correct_answer` from the same bank. | `src/app/api/diagnostic/next/route.ts:62-80`; `src/app/api/practice/questions/route.ts:47-155` |
| H3 | **High** (confirmed live) | Practice exams count toward stats and the public leaderboard | Start with `isPractice:true` (answers shown), finish with 150 → trigger `update_user_stats_on_complete` (no `is_practice` filter, verified in `pg_proc`) sets `best_score=150` and upserts `leaderboard`. `merge-guest` does filter practice, so numbers are also inconsistent. | `src/app/api/exam/start/route.ts:36`; `supabase-schema.sql:124-147`; `src/app/api/auth/merge-guest/route.ts:145` |
| H4 | **High** | Reading sections can serve excluded/retired questions | `pick_informative_passage` requires ≥5 active & eligible questions, but `buildRCQuestions` fetches `.eq('passage_id').limit(5)` with no `active`/`exam_eligible` filter and no order → an excluded (contradictory) item can be served and scored, displacing an eligible one. | `src/lib/question-history.ts:215-230`; `…exam_level_accuracy.sql:73-78` |
| M1 | Medium | Stored θ/SE/P(exempt) disagree with the capped score | Base 130, with experimental 137 → score stored 132 but `theta_final` = θ of 137; results page shows 132 next to an exemption probability and range computed from 137. | `src/app/api/exam/answer/route.ts:200-216` |
| M2 | Medium | Server error turned into "ran out of time" | A timely submit gets a transient 503 (next section unfillable, `:254-256`); the retry arrives >20 s after expiry → all answers recorded blank. | `src/app/api/exam/answer/route.ts:106-110,254-256`; `src/app/exam/[sessionId]/page.tsx:221-224,294-301` |
| M3 | Medium | Global Enter/Space handler hijacks focused buttons | On the last question, a keyboard user focused on "סיים פרק" or the exit dialog cannot activate it; same in practice/review for the error-cause tagger. | `src/app/exam/[sessionId]/page.tsx:153-171`; `src/app/practice/page.tsx:358-360`; `src/app/review-queue/page.tsx:241-242` |
| M4 | Medium | Selected answer not announced to screen readers | Options have no `aria-pressed`/radio semantics; nav dots have no `aria-current`. | `src/components/exam/QuestionCard.tsx:121-137`; `src/app/exam/[sessionId]/page.tsx:460-474` |
| M5 | Medium | AI-generated questions enter the live exam pool unchecked | `generateQuestions` output is inserted with `active`/`exam_eligible` default true; no check of 4 options, key range, explanation shape, duplicates; malformed `options_analysis` crashes `RichText` (`text.split`). | `src/lib/ai.ts:104-120`; `src/app/api/questions/generate/route.ts:21-28,46-59,73-84`; `src/components/RichText.tsx:27` |
| M6 | Medium | Guest→account merge is non-atomic and ignores errors | A timeout while moving `responses` leaves rows under the guest id; the cookie is deleted anyway, so they can never be merged. | `src/app/api/auth/merge-guest/route.ts:58-108,190-191` |
| M7 | Medium | Score-label colours fail contrast | `text-yellow-600` on white ≈2.9:1; in dark mode `text-red-700` ≈2.3:1 for the headline classification. | `src/types/exam.ts:117-124`; `src/app/results/[sessionId]/page.tsx:139` |
| M8 | Medium | Heavy payloads / serial writes | `/api/stats` returns `section_results` (full question rows, passage copied 5×) for every exam; exam completion runs ~27 sequential SRS round trips before responding. | `src/app/api/stats/route.ts:16-23`; `src/app/api/today-session/route.ts:78-87`; `src/lib/srs.ts:200-275` |
| M9 | Medium | Practice seen-history can silently stop working | Selecting all ids of a bucket hits the 1000-row default cap; the large `.in()` URL can fail and the error is ignored → dedup silently off. | `src/lib/question-history.ts:61-77` |
| M10 | Medium | Section targeting looser than designed | `p_needed = p_pool = 80` → random draw of 4 from the top 80; `RANDOMESQUE_FACTOR` unused. Simulation still gave RMSE ≈8.6 points, but precision near the cut score is lower than the design intends. | `src/lib/item-selection.ts:17-22,38-54` |
| L1 | Low | Rate-limit per-actor bucket bypass via random `Authorization` header | Only the 600/min IP limit remains. | `src/proxy.ts:42-48` |
| L2 | Low | Guest HMAC key falls back to the service-role key | Key reuse across purposes. | `src/lib/guest-token.ts:30-32` |
| L3 | Low | `/api/responses/tag` reveals correctness mid-exam | 409 for correct, 200 for wrong on committed sections. | `src/app/api/responses/tag/route.ts:30-41` |
| L4 | Low | Items marked "seen" before the session row exists | If the insert fails, those items are burned for the user. | `src/app/api/exam/start/route.ts:57,87-96` |
| L5 | Low | GET with a delete side effect | `/api/today-session` can delete seen-history. | `src/lib/question-history.ts:35-41` |
| L6 | Low | Unfinished practice session shows score 100 | `thetaToScore(0)` shown for an unfinished practice exam. | `src/app/api/exam/results/route.ts:31` |
| L7 | Low | Concurrent official-score PUT → 500 | Unique `(user_id,test_date)` race. | `src/app/api/official-score/route.ts:50-71` |
| L8 | Low | Stale comments/schema mislead maintainers | Comments claim a public SELECT policy and that `/api/exam/state` auto-submits (neither true); `supabase-schema.sql` out of date; `docs/SPEC.md` names `middleware.ts` and Geist. | `src/app/api/exam/results/route.ts:7-9`; `src/app/api/exam/answer/route.ts:100-102`; `supabase-schema.sql` |

**Dead/duplicated code:** `RANDOMESQUE_FACTOR` (`item-selection.ts:17`); `estimateOwnerTheta` (`ability.ts:67-72`); unused reset/review branches in `commit_exam_section` (`elo_calibration.sql:260-301`); `routeNextDifficulty` thresholds duplicated by hand in SQL (`exam_level_accuracy.sql:86-89`); `guestId` params sent by clients but ignored by the server (`results/[sessionId]/page.tsx:40-41`, `exam/page.tsx:63-67`).

**Test coverage:** 54 unit test files (node env only → no component tests). Untested: `exam/start`, `exam/review`, `questions/generate`, `stats`, `question-history.ts` (where H4 lives), `calibration-server.ts`, `ai.ts`, `proxy.ts`; SQL functions have no automated tests.

---

## 6. Prioritized improvements (impact × severity / effort)

| Rank | What | Why | Where | Effort |
|---|---|---|---|---|
| 1 | Add `.eq('active', true).eq('exam_eligible', true)` (and a stable order) to `buildRCQuestions` | Excluded contradictory items are still served in reading sections | `src/lib/question-history.ts:219-224` | S |
| 2 | Filter practice sessions out of the stats/leaderboard trigger (`AND NOT NEW.is_practice`) | Public leaderboard is trivially gamed today | trigger `update_user_stats_on_complete` (live DB; `supabase-schema.sql:124-147`) | S |
| 3 | Only calibrate from responses tied to items actually served (e.g. exam responses, or practice items recorded in seen-history) and require a signed-in owner | Stops anyone from moving `b_calibrated` for all students | `src/app/api/responses/route.ts:79-90`; `src/lib/calibration-server.ts:32-44` | M |
| 4 | Refuse diagnostic/practice lookups of items in the caller's active real exam, and don't return `correct_answer` from `/api/practice/questions` until after the answer is logged | Closes the answer-key oracle | `src/app/api/diagnostic/next/route.ts:62-80`; `src/app/api/practice/questions/route.ts:47-155` | M |
| 5 | Store the capped θ (inverse of the capped score) as `theta_final` and compute SE/P(exempt) from it | Results page contradicts itself when section 7 helps | `src/app/api/exam/answer/route.ts:200-216` | S |
| 6 | On 503/5xx, let the client retry against the original submit time (or extend expiry server-side when the failure was the server's) | Server faults are scored as blank answers | `src/app/api/exam/answer/route.ts:106-110,254-256` | M |
| 7 | Restore targeted randomesque selection: order the candidate pool by information, then `pickDistinctOptions`, then randomize among the top `3×needed` survivors | Better precision near the exemption cut without losing the no-repeat guarantee | `src/lib/item-selection.ts:38-54` | S |
| 8 | Scope the Enter/Space handler to when focus is not on a button; add `aria-pressed`/radiogroup semantics and `aria-current` | Keyboard and screen-reader users can finish sections | `src/app/exam/[sessionId]/page.tsx:153-171,460-474`; `src/components/exam/QuestionCard.tsx:121-137` | S |
| 9 | Validate AI output (4 options, key in range, explanation schema, dedupe) and insert as `exam_eligible=false` pending review | Keeps unreviewed AI items out of the scored exam | `src/lib/ai.ts:104-120`; `src/app/api/questions/generate/route.ts:46-84` | M |
| 10 | Add a Flag Question toggle on the question dots | Official UI feature; the pace hint already references it | `src/app/exam/[sessionId]/page.tsx:460-474`; `src/components/exam/PaceGauge.tsx:26` | S |
| 11 | Make guest merge a single SQL function (transaction) and keep the cookie on failure | Prevents orphaned progress | `src/app/api/auth/merge-guest/route.ts:58-108,190-191` | M |
| 12 | Commit a full schema dump (or migrations creating the missing tables) | Repo can't rebuild the DB; schema file misleads | `supabase-schema.sql`; `supabase/migrations/` | M |
| 13 | Trim `/api/stats` and `/api/today-session` selects to the fields used; batch SRS writes | Payload and completion latency | `src/app/api/stats/route.ts:16-23`; `src/lib/srs.ts:200-275` | M |
| 14 | Fix label contrast (tokens with dark variants) | Accessibility | `src/types/exam.ts:117-124` | S |
| 15 | Second experimental section with a new item type (grammar in context / word formation) | Closes the main fidelity gap | `src/types/exam.ts:68`; `src/app/api/exam/answer/route.ts:186-216` | L |

---

## 7. Unverified / blocked

- **Live schema** for `user_question_history`, `user_passage_history`, `activity_log`, `review_queue`, `vocabulary`, `user_vocab_*`: no DDL in the repo; not dumped (looked in `supabase/migrations/`, `supabase-schema.sql`, `docs/SPEC.md:74-81,304-335`).
- **θ→score mapping vs NITE**: needs official score pairs (≈30 for the shift); `official_score_linking` exists but has 0 rows (`src/lib/calibration.ts:7-20`).
- **Official rules on ending a section early and late submission**: not stated in the NITE presentation; the app's "no finishing with blanks" and "late = blank" rules are its own choices (`src/app/exam/[sessionId]/page.tsx:263-276`; `answer/route.ts:106-110`).
- **Whether practice buckets exceed 1,000 ids** (M9 trigger condition): depends on live bucket sizes, not queried.
- **H1 end-to-end**: the code path was traced and the calibration SQL read; the attack was not executed (read-only audit).
- **Amiram (not Amirnet) mode**: the app targets Amirnet only; spec (a)'s Amiram figures could not be matched to any mode.
