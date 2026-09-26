# DB explanations polish (`feat/db-explanations-polish`)

- [x] Survey the data: 7,542 questions, every `explanation` is JSON (`correct_reason`, `options_analysis` ×4, `strategy`); 345 rows also have a `hint`
- [x] Pure, tested rules in `src/lib/hebrew-polish.ts` (13 tests): gloss pattern, leading labels, remaining dashes, sentence gaps; idempotent; wording untouched
- [x] Script `scripts/polish-explanations.ts`: dry run by default, `--apply` writes a backup first and updates only `explanation` / `hint` of changed rows
- [x] Dry run: 7,064 rows to change, 24,417 → 65 long dashes (the 65 are inside English quotes), 0 problems (option count, JSON shape, idempotency)
- [x] RTL: explanations, options analysis, strategy and hint now render through `RichText` (English runs bidi-isolated) in `QuestionCard`
- [x] Generator prompt (`src/lib/ai.ts`) asks for active voice, no long dashes, and the `word (תרגום): reason` gloss format
- [x] **Approval** to run `--apply` against production
- [x] Run `--apply`: 7,064 rows updated, 0 failed; a second dry run finds 0 rows left to change
- [x] Commit the backup file: `backups/explanations-2026-09-25T05-25-06-672Z.json` (7,064 original rows)
- [x] Spot-check after deploy: live practice explanation shows the new format, no long dashes, English isolated with <bdi>

## Found along the way
- "לא נפתר" in this data is subject matter ("the problem remains unsolved"), not feedback to the student, so it is deliberately left as is; there is no "you didn't solve" phrasing in the DB to turn into "שגית".
- Some explanations are written partly or fully in English (e.g. "tentative means not final; ending suggests final"). Rules can't translate them; they need a separate rewrite pass (LLM + review).
- The rules fix punctuation and structure only. The telegraphic style ("הפוך: נאמר נעדר, לא כלל") remains; turning 30k fragments into full sentences also needs an LLM pass with human spot-checks.

# Bilingual UX sweep (`fix/perfect-bilingual-ux`)

- [x] Number agreement: `heCount` / `agree` in `src/lib/hebrew-count.ts` (tested) — "שאלה אחת", "שתי שאלות", "יומיים", "מבחן אחד"; verbs and adjectives agree ("שאלה אחת חרגה", "שאלה אחת שגויה")
- [x] Applied in: today, diagnostic, practice results, results pace card, review header, review queue, stats (readiness list, exams-to-goal), leaderboard, vocabulary (review timing, filter button, known/wrong counts), exam date card, hero tagline, Victory Path (+ summary), exam "unanswered" warning, Pro Tip card
- [x] RTL truncation: English text in RTL boxes gets its own LTR box so the ellipsis and final punctuation stay on the correct side (review-queue question list, vocabulary example sentences); verified in the browser that the period no longer jumps to the front of the sentence
- [x] User-entered/English text: `dir="auto"` for names (user menu, leaderboard) and vocabulary search; emails in login confirmations wrapped in an LTR isolate; search chip isolates the query
- [x] Inputs: password fields in the user menu are LTR; Hebrew placeholders stay right-aligned; name field follows what is typed
- [x] Empty states and fallback errors rewritten warm and specific (stats, leaderboard, review, review queue, vocabulary favorites/search/quiz/timed, practice fallback, daily rings)
- [x] Mixed flow: "השלמת משפטים 3/4" → "השלמת משפטים: 3 מתוך 4"; "מתחת ל-70% ב: …" → "פחות מ-70% הצלחה: …"; ESRA label consistent
- [ ] Admin panel copy (internal, out of scope)

# Visual QA audit (`fix/visual-qa-audit`)

- [x] Sentence breaking: new polish rule 5 — "ENG = עברית" opening a sentence becomes "ENG (עברית)" for a short gloss, "עברית (ENG)" for an explanation, and "ENG (gloss): reason" when a reason follows (17 tests). Dry run: 4,601 rows, 0 problems
- [x] Applied rule 5 on production: 4,601 rows updated, 0 failed; backup `backups/explanations-2026-09-25T07-01-54-095Z.json`; a second dry run finds 0 rows left
- [x] Victory chart: X-axis dates render RTL ("7 ביולי"); three states — reached / steady (no "0 ימים", no "+-0.0") / rising with a readable rate ("כ-1.2 נק׳ ביום", per week when tiny)
- [x] Score classification descriptions: no semicolons ("טווח נפוץ. את הסיווג בפועל קובע המוסד"); stats shows label and description on separate lines instead of a dash
- [x] Tildes: estimated scores already isolated (`~102`); strategy time budget "~60 שניות" → "כ-60 שניות"
- [x] Counters: "X / Y" → "X מתוך Y" (results, review queue, stats, vocabulary progress/quiz/speed test); large totals formatted "1,158"
- [x] Text pseudo-icons (‹ › ← → | ✓ ✗) replaced with Lucide icons in 14 components; RTL direction fixed (back = right-pointing, forward = left-pointing); swipe and keyboard hints rebuilt with icons and <kbd>
- [x] Number lines read left → right: exemption gauge arc and 50–150 track, diagnostic level strip, practice difficulty picker, stats by-difficulty, vocabulary level filter; score ranges ("50–84") isolated LTR on home, results, practice and diagnostic

# Visual QA audit, part 2 (`fix/visual-qa-audit-part2`)

- [x] Exam date shown in Hebrew with the year ("24 בנובמבר 2026"); the date field shows a Hebrew label over the native picker (which formats by browser locale), and still opens the native picker on tap
- [x] "הסר את תאריך המבחן" text button removed from the editor; a trash icon now sits next to the edit icon inside the date card, with errors shown in the card
- [x] Text arrows: "התחל", "הבא", "התחל כאן" and the plan-screen list already render Lucide SVG icons with RTL-correct direction (verified in the browser: every button and list row has its SVG)
- [x] Diagnostic plan: one encouraging sentence under the level strip; range, type comparison and calibration note moved into a collapsed "איך הרמה חושבה?"

# Static text vs dynamic state (`fix/dynamic-copy-audit`)

- [x] Diagnostic plan: the level explanation follows the strip. One level: "התשובות שלך הצביעו בבירור על רמה X, ולכן רק היא מסומנת" (no mention of light squares); a range: dark = best estimate, light = the rest of the range (no longer "around it", since the range can sit on one side); strip aria-label says "הרמה שלך: X" for a single level
- [x] Plan-screen arrows ("התחל כאן", the "אחר כך" list, "איך הרמה חושבה?") verified as Lucide SVGs (arrow-left, chevron-left, chevron-down that flips when open); no text arrows on the page
- [x] Stats readiness: "ממוצע 3 האומדנים האחרונים" now names what it averages (last exam / two / three); the stability line ("פער בין המבחנים") is shown only with 2+ exams; "כל סוגי השאלות מעל 70%" is shown only when there is per-type data
- [x] Stats by difficulty: a level with no questions shows a neutral "— · עוד לא תרגלת" card instead of a red "0%" and "0/0", and keeps its slot so the scale stays easy → hard
- [x] Results: question types and sections with 0 questions (e.g. a skipped section) are hidden instead of showing "0/0 · 0%"
- [x] Review screen: header reads "אין שאלות שגויות" / "אין תשובות נכונות" instead of "0 שאלות"; the empty "correct" filter has its own message
- [x] Agreement: exemption frequency ("בערך אחד מתוך 10 נבחנים… נמצא", no repeated "מתוך 10"), "נקודה אחת עד היעד", "מילה שזכרת", "מתוך שתי שאלות", singular delete confirmations (review queue, category, favorites)
- [x] Positional claims removed where the target may not render ("התמקד בחולשות למטה")

# Vocabulary horizontal overflow (`fix/vocab-horizontal-overflow`)

- [x] Reproduced at 375px: dragging a card left, or the "לא ידעתי" exit (−400px), widened the page to 532px; in an RTL page left-side overflow is scrollable, which exposed the blank strip
- [x] Page wrapper `overflow-x-clip w-full` (clip, not hidden, so it doesn't become a scroll container); page stays 375px during the drag and the exit
- [x] Card `touch-action: pan-y`: horizontal finger movement drives only the swipe
- [x] `overscroll-behavior-x: none` on the document while the vocabulary page is open, restored on leave

# Vocabulary overlays and card polish (`fix/vocab-modals-polish`, on top of `fix/vocab-horizontal-overflow`)

- [x] One overlay pattern: `src/components/ui/Modal.tsx` — full-screen dimmed backdrop, single centered panel (portal to <body>), close on backdrop / X / Escape, page scroll locked, focus to close and back, header actions + pinned footer
- [x] Moved onto it: vocabulary Favorites and Filters (were bottom sheets), review-queue question picker (was a bottom sheet)
- [x] Quick-test settings and results stay in the page: they are the screen of that mode, not overlays (a modal there would leave an empty page behind it)
- [x] Text pointers: every remaining "×" close button (filter chips, search chip, overlay headers) is a Lucide X with an aria-label; the app has no text arrows left (grep of ← → ‹ › « » <- -> × ✓ ✗ in JSX)
- [x] Raw data: `cleanSnippet` (`src/lib/vocab-text.ts`, tested) strips wrapping quotes from examples and the final period from definitions; no more `"…"` around examples; the English definition sits in an LTR block so its period no longer jumps to the start
- [x] Unlearned cards show the definition and example on the front by default; words back for review keep them behind "הצג הגדרה ומשפט לדוגמה" (H still toggles)
- [x] Quick-test settings: rounded pill radio groups ([5] [10] [20], [10] [15] [20] [30]) reading low → high; "שניות לכל מילה" instead of "30ש׳" (which rendered as "’30ש")
- [x] Found along the way: typing in the filter search fired the card shortcuts (H, space, arrows); shortcuts now ignore text fields and open overlays
- [x] Counts: `heCount` groups thousands ("1,158 מילים"); "(פחות מ-1%)" instead of "(0%)" once a word is known; timed score "X מתוך Y"

# Vocabulary logic fixes (`fix/vocab-logic-ux`)

- [x] Buttons match the swipe: "ידעתי" (green, swipe right, → key) on the right, "לא ידעתי" (red, swipe left, ← key) on the left; the keyboard hint lists them in the same order
- [x] Hint restored: an unlearned card shows the definition only; the example sentence waits behind "הצג רמז" (H); a word back for review hides both until the hint
- [x] Filters without duplicates: "סטים נושאיים" = המילים שהפילו אותי, אקדמי, מתקדם, קל להתחלה; "חלקי דיבר" = שמות עצם, פעלים, שמות תואר (adjectives + descriptive), מילות קישור. Favorites stays reachable from the Favorites window only
- [x] Card tags use the same names ("מחברים" → "מילות קישור", "תיאורי" → "שמות תואר")
- Note: `category` holds either a part of speech or a theme, so the 300 words tagged academic/advanced (178 + 122) don't appear under any part of speech. Tagging them needs a data pass.

# Vocabulary part of speech (`feat/vocab-part-of-speech`)

- [x] Migration `20260925120000_vocab_part_of_speech.sql`: nullable `part_of_speech` column (noun | verb | adjective | adverb | connector) with a check constraint; `category` untouched and keeps the theme
- [x] Reviewed mapping `scripts/data/vocab-part-of-speech.json` for all 1,158 words: 355 adjectives, 308 verbs, 291 nouns, 122 connectors, 82 adverbs. First pass from the definitions ("To …" = verb, "A/The …" = noun, …), then every disagreement with the old category and all 300 academic/advanced words reviewed by hand
- [x] Old categories corrected on the way: -ly words filed under "connectors"/"descriptive" are adverbs (primarily, largely, apparently…); "integrity", "consensus", "defiance" are nouns; linking phrases (despite, owing to, what is more) are connectors
- [x] `scripts/backfill-part-of-speech.ts`: dry run by default; `--apply` refuses on any mismatch, writes `backups/part-of-speech-<ts>.json`, updates only `part_of_speech`, re-reads to verify
- [x] App: filter "חלקי דיבר" reads `part_of_speech` (falls back to the old category until the backfill), new chip "תוארי פועל"; the card shows grammar and theme as separate tags ("שם עצם" + "אקדמי")
- [x] Migration applied on production (column empty, check constraint in place, no new security advisor findings); dry run: 1,158 rows to fill, 0 problems
- [x] Backfill applied: 1,158 rows updated, verify 1,158/1,158 match; backup `backups/part-of-speech-2026-09-25T15-32-21-949Z.json` (all values were null before)
- [ ] Deploy the app change (push) after the backfill

# Vocabulary filter rebuild (`fix/vocab-cache-and-filters`)

- [x] Bug: a 6-hour browser cache from before part_of_speech ("vocab_cache_v3") made "אקדמי" + any kind of word show nothing; cache is now v4 and refuses rows missing part_of_speech
- [x] Filter model (`src/lib/vocab-filter.ts`, 9 tests): four independent questions — אילו מילים (all / mistakes / favorites), רק מילים אקדמיות, סוג המילה (multi), רמת קושי (multi). OR inside a question, AND across them
- [x] Live count on every choice, computed against everything else already chosen; choices that would give 0 are turned off, so no combination ends empty (verified: academic → verbs 12, nouns 137, adverbs/connectors off; verbs + nouns = 149 = sum of the level counts)
- [x] Human wording: "סוג המילה" instead of "חלקי דיבר"; "מילים שטעיתי בהן", "המועדפים שלי", "רק מילים אקדמיות" with a one-line explanation; removable chips for everything active
- [x] "מתקדם" / "קל להתחלה" removed as sets: they were levels 4–5 / 1–2 and contradicted the level row
- [x] Old ?pack= links still work (strategy tip "מילות קישור" link fixed: it pointed at a removed set)
- [x] Quiz distractors: same kind of word (a verb against verbs) instead of the legacy category
- [x] Found along the way: "מילים שטעיתי בהן" showed "—" as the translation since the explanations polish ("word (תרגום)"); `extractGloss` reads both formats (tested)
- [x] Category reset prepared: `scripts/data/vocab-category.json` (494 academic = Academic Word List families + subject terms, 664 general) and `scripts/reset-vocab-categories.ts`; dry run 1,001 rows to change, 0 problems
- [x] Card front shows the word only; "הצג רמז" reveals the example sentence; the definition is on the back with the translation
- [x] Category reset applied: 1,158/1,158 verified (494 academic, 664 general). The first run updated the 337 academic rows, then the 664-row update overflowed the request URL; updates are now chunked (both scripts) and the rerun finished the general rows. Backups: `backups/vocab-category-2026-09-25T15-57-34-395Z.json` (all 1,001 original values) and `…15-57-51-344Z.json` (the 664 still unchanged at the rerun)
- [x] Migration `vocab_category_theme_only` applied: category NOT NULL, default general, check (academic | general)
- [ ] Deploy (push)

# Vocabulary expansion to 350 words per level (`feat/vocab-expansion`)

- [x] Deficits (from the live database, 1,158 words): L1 103 → 247 missing, L2 243 → 107, L3 235 → 115, L4 238 → 112, L5 339 → 11; 592 new words in total
- [x] Insert-only script `scripts/insert-vocab-batch.ts`: dry run by default; per-row checks (fields, allowed values, clean text, example uses the word, Hebrew), duplicates against the live database and inside the batch, family warnings that must be acknowledged, per-level cap of 350; one all-or-nothing insert with an id log; `--rollback` deletes exactly the logged rows
- [x] Guards tested on a deliberately broken batch (nothing written, all 9 problems reported; found and fixed a bug where later rows went unchecked)
- [x] Batch 1: 50 level-1 words (`scripts/data/vocab-batches/level1-batch01.json`), 0 errors against the live database; 3 family warnings to review (rate, quality, advantage)
- [x] Batch 1 inserted: 50 words (rate, quality, advantage acknowledged), 1,158 → 1,208 verified; level 1 now 153 (197 to go). Log for --rollback: `backups/vocab-insert-2026-09-25T16-16-26-310Z.json`
- [x] Batch 2 prepared: 100 level-1 words, 0 errors; 9 family warnings reviewed (6 false matches, 3 shared roots kept); government, probably, popular (true families) and reduce (exists) replaced
- [x] Batch 2 inserted: 100 words, 1,208 → 1,308 verified; level 1 now 253 (97 to go). Log: `backups/vocab-insert-2026-09-25T16-25-07-162Z.json`
- [x] Batch 3 prepared: the last 97 level-1 words, 0 errors, level 1 would reach exactly 350; 4 family warnings for review (promise, reason, alone, soon)
- [x] Batch 3 inserted: 97 words, 1,308 → 1,405 verified; level 1 complete at 350. Log: `backups/vocab-insert-2026-09-26T06-52-27-709Z.json`
- [x] Level 2 batch 1 prepared: 54 words from Academic Word List sublists 1–4, 0 errors; 6 family warnings for review (contract, percent, credit, invest, participate, shift)
- [x] Level 2 batch 1 inserted: 54 words, 1,405 → 1,459 verified; level 2 now 297. Log: `backups/vocab-insert-2026-09-26T06-56-43-478Z.json`
- [x] Level 2 batch 2 prepared: 53 words, 0 errors, level 2 would reach 350. Academic Word List sublists 1–3 are exhausted (only reside, compute, commission, scheme, corporate were left without a family variant in the bank); the other 48 are general B1–B2 words, so no sublist 4–6 word is forced into level 2. 6 family warnings for review
- [x] Level 2 batch 2 inserted: 53 words, 1,459 → 1,512 verified; level 2 complete at 350. Log: `backups/vocab-insert-2026-09-26T07-02-36-107Z.json`
- [x] Level 3 batch 1 prepared: 58 words from Academic Word List sublists 4–7 (easy members like job, media, topic left out), 0 errors; 4 family warnings, all look-alikes (consult, mental, transit, extract)
- [x] Level 3 batch 1 inserted: 58 words, 1,512 → 1,570 verified; level 3 now 293. Log: `backups/vocab-insert-2026-09-26T07-08-31-792Z.json`
- [x] Level 3 batch 2 prepared: 57 words (6 academic from sublists 4–7, 51 general B2), 0 errors, level 3 would reach 350; 6 family warnings, all different words
- [x] Level 3 batch 2 inserted: 57 words, 1,570 → 1,627 verified; level 3 complete at 350. Log: `backups/vocab-insert-2026-09-26T07-11-56-908Z.json`
- [x] Level 4 batch 1 prepared: 56 words (42 from Academic Word List sublists 8–10, easy members left out; 14 general C1), 0 errors; 8 family warnings, all different words
- [x] Level 4 batch 1 inserted: 56 words, 1,627 → 1,683 verified; level 4 now 294. Log: `backups/vocab-insert-2026-09-26T07-16-27-320Z.json`
- [x] Level 4 batch 2 prepared: 56 general C1 words (the Academic Word List is used up for this level), 0 errors, level 4 would reach 350; 1 family warning (contingency, a look-alike). Left out for families: commend, concur, reassure, impetus, influx, unprecedented, subside
- [x] Level 4 batch 2 inserted: 56 words, 1,683 → 1,739 verified; level 4 complete at 350. Log: `backups/vocab-insert-2026-09-26T07-25-04-349Z.json`
- [x] Level 5 batch prepared: the last 11 words (GRE level), 0 errors, 0 family warnings; disparage swapped for denigrate (too close to disparate / disparity)
- [x] Level 5 batch inserted: 11 words, 1,739 → 1,750 verified. Log: `backups/vocab-insert-2026-09-26T07-30-00-972Z.json`
- [x] Final audit (live database): 1,750 words, 350 per level, 1,750 distinct (case-insensitive), 0 without part of speech, 0 trailing periods, 0 quote marks, 0 without Hebrew; 686 academic / 1,064 general; verbs 544, nouns 509, adjectives 453, connectors 134, adverbs 110
- [x] Definitions cleanup (`scripts/clean-vocab-definitions.ts`): 635 trailing periods removed, 0 failed, verify 0 left; parsimonious's two sentences joined with a semicolon. Backup `backups/vocab-definitions-2026-09-25T16-19-10-685Z.json`. Audit before the run: no ellipses, quote marks, stray spaces or uppercase words anywhere

# Level audit of the original 1,158 words (`fix/vocab-level-audit`)

- [x] Plan approved: scale = project scale (1 top-2000 · 2 Academic Word List 1–3 / B1–B2 · 3 AWL 4–7 / B2 · 4 AWL 8–10 / C1 · 5 C2 / GRE); only the original words; high-confidence moves only; strict 1-to-1 swaps where both words end up closer to their true level
- [x] Finding: level 5 holds dozens of B2–C1 words, but only 11 truly C2 words sit lower (10 at level 4, 1 at level 3), so at most 11 can leave level 5; level 4 holds many basic connectors (as a result, even though, in addition…), level 1 a few hard words (novel, precise, progressive, uniform)
- [x] `scripts/swap-vocab-levels.ts` + `scripts/data/vocab-level-swaps.json`: 33 pairs, 66 words; dry run 0 errors, 350 per level before and after; guards proven on a broken file (5 errors caught, nothing written)
- [x] Applied: 66/66 words at their new level, 350 per level verified. Backup `backups/vocab-levels-2026-09-26T07-40-12-552Z.json`
- [x] Cycles allowed. Every moved word lands exactly on its true level. Bottleneck found: no C2 words remain outside level 5 and only 6 level-4-grade words sit lower, so level 5 cannot shed words and level 4 can shed only 6. Maximum under those limits: 64 moves = 5 swaps (1↔2) + 18 swaps (2↔3) + 6 cycles (4→2→3→4) — computed from the level balance, not guessed
- [x] Script generalized to closed groups (swaps and cycles), guard proven on an open cycle; `scripts/data/vocab-level-cycles.json` dry run 0 errors, 350 per level
- [x] Round 2 applied: 64/64 words at their new level, 350 per level verified. Backup `backups/vocab-levels-2026-09-26T07-44-39-432Z.json`
- [ ] Remaining (content decision, not placement): ~55 too-easy words in level 4 and ~26 in level 5 cannot move without harder words to replace them

# Archive and replace easy words in levels 4–5 (Option C, `fix/vocab-level-audit`)

- [x] Scope agreed: only general, non-connector words that are clearly B2 or easier; academic words and connectors stay. Exact count from the database: 32 (18 in level 4, 14 in level 5), not ~55 — the rest of the earlier estimate were academic science terms
- [x] Archive, not delete: `user_vocab_known` / `user_vocab_favorites` cascade on delete, so migration `20260926090000_vocab_archive.sql` adds `is_archived` (default false); archived words keep users' progress and are hidden from the app
- [x] 32 replacements: 18 true C1 for level 4, 14 true C2 / GRE for level 5; same validation as every batch (shared `scripts/lib/vocab-rules.ts`), duplicates and families checked against all words; 2 family warnings reviewed (conducive/conduct, disseminate/dissent)
- [x] `scripts/archive-replace-vocab.ts`: read-only checks, generates one all-or-nothing SQL block (`supabase/data-ops/vocab-archive-replace.sql`) that raises unless exactly 32 archived, 32 inserted and 350 active per level; plus a revert block
- [x] App: vocabulary page and today's session skip archived words; cache v5
- [ ] **Approval**, then in order: migration → deploy app (push) → run the operation SQL
