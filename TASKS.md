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
- [ ] Spot-check a practice question's explanation in the browser after deploy

## Found along the way
- "לא נפתר" in this data is subject matter ("the problem remains unsolved"), not feedback to the student, so it is deliberately left as is; there is no "you didn't solve" phrasing in the DB to turn into "שגית".
- Some explanations are written partly or fully in English (e.g. "tentative means not final; ending suggests final"). Rules can't translate them; they need a separate rewrite pass (LLM + review).
- The rules fix punctuation and structure only. The telegraphic style ("הפוך: נאמר נעדר, לא כלל") remains; turning 30k fragments into full sentences also needs an LLM pass with human spot-checks.
