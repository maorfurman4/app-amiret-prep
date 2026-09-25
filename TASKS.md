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
