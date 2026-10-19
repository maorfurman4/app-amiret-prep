# Content audit — `public.questions` (2026-10-18/19)

Scope: all **7,428 active items** (2,500 reading / 2,486 restatement / 2,442 sentence completion)
and their 500 passages, Supabase project `pxksqbuqfwbrluuiyedp`. Read-only: nothing has been
written to the database. Fixes are in the dry-run [`audit/dry-run-fixes.sql`](audit/dry-run-fixes.sql).

## TL;DR

1. **Answer keys are clean.** 0 confirmed mis-keys in 2,520 blind-judged items.
2. **Real wording/answer defects are rare.** About 2–4% of items are candidates, concentrated in sentence
   completion, where a distractor fits as well as the key.
3. **Difficulty is the problem, as the pilot suggested.** About 30% of the sample is below the floor of the
   real AMIRNET, and half of the reading items are.
4. **New, pool-wide, and the biggest validity issue: the key is the longest option.** On restatement
   (89%) and reading (86%) items, "pick the longest answer" beats chance (25%) by more than 3×.
   No SQL flag fixes this; the distractors need rewriting.
5. **The "repeated option words" bug is not in the set builder.** The no-repeat rule covers all four
   options and holds in simulation. The reported repeat is the option-list render bug (see Job 2).

## Method

| Stage | Coverage | How |
|---|---|---|
| Structural checks | 7,428 / 7,428 | 4 options, key in range, no empty or duplicate options, every RC passage present and active: **0 issues** |
| Blind LLM judging | **2,520 / 7,428 (34%)**: 840 per type, random order | 40-item batches. Judges never saw the key (keys kept outside the repo). Rubric: [`audit/RUBRIC.md`](audit/RUBRIC.md). Results: [`audit/progress.ndjson`](audit/progress.ndjson) |
| Programmatic difficulty | 7,428 / 7,428 | `wordfreq` Zipf rarity, stem length, key/stem and key/passage overlap, distractor absolutes, length cue ([`scripts/audit/cheap_difficulty.py`](../scripts/audit/cheap_difficulty.py)) |
| Programmatic wording | 7,428 items + 500 passages | Rule lint (a/an, stray or double punctuation, doubled words, blank count, quotes) plus a `wordfreq` spelling dictionary ([`scripts/audit/lint_wording.py`](../scripts/audit/lint_wording.py)). LanguageTool was not used: no JDK on this machine |
| Key-length cue, distractor reuse | 7,428 / 7,428 | Exact counts against the keys |

LLM judging was stopped at 34% on purpose. Keys came out clean and defect rates were stable from 800
items onward, so judging the rest would have cost about 14M tokens for little new information. The programmatic
passes cover everything.

## 1. Correctness: blind sample (2,520 items)

| Type | Judged | Mis-keyed | Correctness candidates¹ | Wording/grammar flags | Cross-cue (RC) | Passage errors |
|---|---|---|---|---|---|---|
| Reading | 840 | 0 | 16 (1.9%) | 20 | 20 | 16 |
| Restatement | 840 | 0 | 23 (2.7%) | 27 | — | — |
| Sentence completion | 840 | 0 | 58 (6.9%) | 16 | — | — |
| **All** | **2,520** | **0** | **97 (3.8%)** | **63** | **20** | **16** |

¹ ambiguous / no correct answer / distractor also correct / RC answer not supported. All are listed
with the judge's reason in [`audit/flagged-items.md`](audit/flagged-items.md).

- **Mis-keys.** The judges disagreed with the stored key twice. `3d427d54` is a judge slip: a trivial
  "apologized → said sorry" item, and the key is right. `30b04cf2` is **real**: "The decision was made
  *politically*, without much regard for how the public would react" contradicts itself, and no option
  fits. It's already exam-ineligible; the dry-run deactivates it.
- **Hand-verified** (deactivated in the dry-run): `5d3bf588` ("attempts/tries/hopes to become" also
  fit), `d0588594` (no context clue: condemned/questioned/ignored/endorsed all fit), and `68e8f73b`
  ("tired because he had studied hard" is as logical as the key).
- **Judge reliability.** Answers were consistent (2,518 of 2,520 matched the key). Difficulty tags were
  less so: on the same randomized content, too-easy rates per restatement batch ranged from 5/40 to 32/40.
  Treat a single judge's too-easy tag as noisy. That's why §3 requires two signals before changing
  anything.
- **Not done: web adjudication (dictionary sources) of the ~90 un-verified candidates.** Instead,
  the dry-run removes the SC and restatement candidates from **scored exams only**. That's reversible, and they stay
  in practice until someone rewrites them.

## 2. Wording: whole pool, programmatic

The lint found very little, which matches the sample.

| Finding | Items | Action in dry-run |
|---|---|---|
| "a otherwise comparable", "bears a instructive" (2 passages) | 2 | fix to "an" |
| Stray space after the blank: `___ ,` `___ ;` `___ :` (SC stems) | 7 | remove space |
| "more unifiedly" (RC option `08cd4551`) | 1 | "in a more unified way" |
| Umami stem: "what does umami primarily detect" (`90f9f49d`) — umami is a taste | 1 | "what do umami receptors primarily detect" |
| "sacrificeable" (`1dc7cba8`), "searchably" (`251ff3bc` and its passage) | 2 | listed only (rare variants, not errors) |
| "readed", "eloquences" | 2 | none: deliberate wrong-form SC distractors |
| Rare technical words (*emergentism, substantivalism, glymphatic…*, 60+ types) | ~100 | none: spelled right, but obscure for AMIRNET (possible too-hard, mostly level-5 passages) |

**Passage template monotony.** 93 / 500 passages (19%) open with the same fronted-inversion pattern:
"Not without…" (38), "Rarely has…" (29), "Seldom has…" (19), "Not until…" (5), "So…" (2). Judges
flagged a few as self-contradictory (`passage_error` in `flagged-items.md`). These openings are grammatical
but read as obviously machine-written; vary them in any regeneration.

**RC stem variety.** In the sample, 162 / 840 RC stems (19%) are the generic "What is the passage
mainly about?" type (about 547 pool-wide). They aren't duplicates, since each is on a different passage, but real AMIRNET
varies the phrasing.

## 3. Difficulty

### LLM sample
Too easy: **774 / 2,520 (30.7%)**. Reading **410 / 840 (49%)**, restatement 250 / 840 (30%), SC 114 / 840 (14%).
Too hard: 2.

**Why reading items are easy.** It isn't the passages. Many passages are dense C1 academic text, but the
key copies a passage sentence nearly word for word, and the distractors are absurd absolutes ("never",
"no effect whatsoever", "a biography"). A level-5 passage then gets level-1 questions.

**Stored levels run high** (rows = stored `difficulty_level`, cells = judge's estimated level):

| stored → est. | 1 | 2 | 3 | 4 | 5 |
|---|---|---|---|---|---|
| 1 | 392 | 31 | | | |
| 2 | 300 | 266 | 37 | | |
| 3 | 97 | 289 | 129 | 2 | |
| 4 | 46 | 184 | 232 | 29 | |
| 5 | 25 | 141 | 158 | 149 | 13 |

### Programmatic score vs the LLM (held-out half of the sample)
Thresholds were tuned on even-numbered batches. Agreement is reported on odd-numbered batches only.

| Type | Agreement | Cohen's κ | Precision | Recall | ρ(score, stored level) | ρ(score, LLM est. level) |
|---|---|---|---|---|---|---|
| Reading | **73.4%** | 0.47 | 0.82 | 0.67 | −0.10 | +0.18 |
| Restatement | **76.6%** | 0.39 | 0.60 | 0.50 | +0.67 | +0.59 |
| Sentence completion | **85.0%** | 0.44 | 0.43 | 0.65 | +0.73 | +0.70 |

How far to trust it: moderate agreement (κ ≈ 0.4–0.5). It's a good ranking signal for SC and
restatement, where it tracks stored levels well. It's useless for ranking reading items against
stored level, because RC levels describe the passage, not the questions.

### "Confirmed too-easy" (what the dry-run acts on)
An item counts as confirmed only with two signals: **judged items** need both the LLM tag and the cheap tag;
**unjudged items** need a cheap score past a stricter threshold with ≥ 0.85 held-out precision.

| Type | Confirmed too-easy | Acted on in dry-run |
|---|---|---|
| Restatement | 251 | `exam_eligible = false` |
| SC | 72 (judged only; no cheap threshold reaches 0.85 precision for SC) | `exam_eligible = false` |
| Reading | 867 | **no**, see below |

**Why reading is excluded.** `pick_informative_passage` only serves passages with all 5 questions
`exam_eligible` (`having count(*) >= 5`). Flagging RC questions one by one would cut the exam's servable
passages from **500 to 95** (level 5: 100 → 9). Fix reading by rewriting distractors (non-absurd,
paraphrased keys), not by filtering.

Exam pools after the dry-run (eligible items per level 1–5):
- Restatement: 440 / 496 / 494 / 488 / 497 → **279 / 455 / 473 / 484 / 496**
- SC: 353 / 456 / 453 / 433 / 472 → **292 / 450 / 452 / 433 / 472**

All stay well above what an exam draws.

## 4. Key-length cue (whole pool) — the biggest validity issue

| Type | Key is the uniquely longest option | Chance | Key ≥ 1.3× the next-longest |
|---|---|---|---|
| Restatement | **2,217 / 2,486 (89%)** | 25% | 1,173 (47%) |
| Reading | **2,142 / 2,500 (86%)** | 25% | 1,486 (59%) |
| Sentence completion | 650 / 2,442 (27%) | 25% | 226 (9%) |

A test-wise student scores about 87% on restatement and reading by picking the longest option without
reading. This inflates every score and will distort IRT calibration once real responses come in.
**Recommendation:** regenerate distractors so options are similar in length (and not absurd). That fixes
§3's reading easiness at the same time. Until then, consider excluding the worst cases (key ≥ 1.3×) from
scored exams. That isn't in the dry-run, because it would remove about 60% of reading passages from exams; it's your call.

## 5. Sentence-completion distractor reuse (Job 2A)

| Metric | Value |
|---|---|
| SC items / option slots | 2,442 / 9,768 |
| Distinct option words | 3,712 (each reused **2.6×** on average) |
| Words in ≥ 10 questions / ≥ 20 questions | 154 / 21 |

Most reused (questions containing it / of which it's the **key**): eliminate 39/4, vague 29/5,
ignored 27/1, ignore 27/0, distinguish 26/1, decline 26/1, timid 26/1, publish 25/1, separate 25/0,
trivial 24/1, careless 23/0, venal 23/1, banal 23/1, forget 22/0, lax 22/3, oppose 22/0, increase 22/7,
celebrate 22/1, hide 21/0, brief 21/1, gratitude 20/1.

**77 words appear in ≥ 8 questions and are never the key**: ignore 27, separate 25, careless 23,
forget 22, oppose 22, hide 21, celebrated 19, bored 17, deny 16, angry 16, conceal 14…
A student who practices enough learns "*ignore* is never the answer". That's a content-level leak
regardless of set building.

The pool is **not** concentrated enough to force repeats within one set: 0 in 12,000 simulated sets
([`scripts/audit/sim-option-repeats.py`](../scripts/audit/sim-option-repeats.py)).

## Deliverables

- [`audit/dry-run-fixes.sql`](audit/dry-run-fixes.sql): BEGIN … ROLLBACK, with backups first (RLS on, API
  grants revoked). Every guard was checked against a fresh read-only export on 2026-10-19: all text
  guards match 1 row, stray-space 7/7, deactivations 4/4, exam-ineligible 31/49 (LLM-flagged) +
  290/317 (too-easy). The others are already ineligible, and the `WHERE exam_eligible` guard skips them.
- [`audit/flagged-items.md`](audit/flagged-items.md): every LLM flag with its reason.
- [`audit/progress.ndjson`](audit/progress.ndjson), [`audit/cheap-difficulty.ndjson`](audit/cheap-difficulty.ndjson),
  [`audit/lint-wording.ndjson`](audit/lint-wording.ndjson), [`audit/confirmed-too-easy.json`](audit/confirmed-too-easy.json): raw outputs.
- Re-run: `scripts/audit/export-items.mjs` (read-only export) → `merge.py` → `cheap_difficulty.py` →
  `lint_wording.py` → `build_deliverables.py`.
