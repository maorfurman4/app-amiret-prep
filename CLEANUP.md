# Cleanup audit — 2026-10-02

Base: `origin/main` @ `f2ce8aa` (after PR #18). Branch: `claude/app-cleanup-audit-cbb17c`.

**Phase 1 status: read-only audit done. Nothing in the app has been removed yet — waiting for approval.**

## How it was checked

- `knip@5` run over the whole repo. It reads Next.js routes, vitest tests, next-pwa and eslint as entry points, so code used only by tests still counts as used.
- Every knip hit was checked again with `grep` across `src/`, `scripts/`, config files and docs, looking for static imports, dynamic `import()`, string paths (`'/route'`) and CSS `@import`.
- Routes: each `src/app/**/page.tsx` and `api/**/route.ts` was searched for an `href`, `router.push`, `fetch` / `authFetch` or config entry that points to it. Dev pages were excluded when counting.
- Unused imports: `eslint .` reports 0 problems. `tsc --noUnusedLocals --noUnusedParameters` finds only 2 unused callback params, both in `src/lib/stats-metrics.test.ts`.
- Commented-out code: searched for comment lines that start with code (`// const|import|return|<Jsx|…`) and for JSX `{/* <… */}` blocks. All hits are prose, so there are **no commented-out blocks**, and no TODO/FIXME either.
- Baseline (before any change) is in the Verification log at the bottom.

---

## SAFE — no references anywhere; removal is expected to stay green

| # | Item | Evidence it's unused |
|---|------|----------------------|
| S1 | `src/components/ui/button.tsx` | shadcn scaffold. knip: unused file. `grep -rn "ui/button"` finds nothing. The app uses plain `<button>` / `<Link>` everywhere. |
| S2 | `src/components/ui/sonner.tsx` | shadcn `Toaster` wrapper. Never mounted: no `Toaster` or `toast(` anywhere outside this file. |
| S3 | `src/lib/utils.ts` (`cn`) | Its only importer is S1. knip: unused file. |
| S4 | npm deps that only S1–S3 use: `@base-ui/react`, `class-variance-authority`, `clsx`, `tailwind-merge`, `sonner`, `next-themes` | grep finds imports only in S1–S3. `next-themes` is not used by the theme toggle (`ThemeToggle.tsx` + the inline script in `layout.tsx` handle dark mode). |
| S5 | npm deps imported nowhere: `@hookform/resolvers`, `react-hook-form`, `date-fns`, `next-pwa`, `workbox-window` | 0 imports in `src`, `scripts`, `worker` or configs. `next-pwa` is the old package; the app uses `@ducanh2912/next-pwa` (`next.config.ts`). `workbox-window` is already a dependency of `@ducanh2912/next-pwa` itself (v7.1.0), so a top-level copy isn't needed. |
| S6 | `public/file.svg`, `globe.svg`, `next.svg`, `vercel.svg`, `window.svg` | create-next-app boilerplate. They appear only in the generated `public/sw.js` precache list, not in any source file. |
| S7 | Stale leaderboard text in `docs/SPEC.md` (§5.11 line 240; lines 82, 92, 331) | §5.11 says the `leaderboard` table and trigger "remain in the DB" and the profile and merge-guest APIs "still sync to it". Both are false: migration `20261001090000_drop_leaderboard.sql` dropped the table and removed the upsert from the trigger, `grep -rn leaderboard src` returns 0, and the keepalive workflow now pings `vocabulary`. This is a doc fix only; the historical changelog lines stay. |
| S8 | 2 unused params `s` in `src/lib/stats-metrics.test.ts:74,144` | Reported by `tsc --noUnusedParameters`. Test code only. |

S1–S5 together remove 11 packages from `dependencies`. On disk, `date-fns` is about 26 MB and `@base-ui` about 20 MB in `node_modules`.

Keeping `components.json` (shadcn config) and `shadcn`/`tw-animate-css` — `globals.css` imports `shadcn/tailwind.css` and `tw-animate-css`, so those packages are live.

---

## NEEDS-DECISION — features, screens, dev tooling, data, docs

### Dev-only artifacts
| # | Item | What it is / evidence |
|---|------|-----------------------|
| D1 | `src/app/dev/profile-preview/` | Dev preview of the profile popover. `notFound()` unless `NODE_ENV==='development'`, so it is a 404 in prod but still built. No links point to it. It existed to design PR #9, which is merged. |
| D2 | `src/app/dev/streak-gamification/` | Dev preview of the streak/flame states from PR #10 (merged). Same gate, no links. |
| D3 | `src/app/dev/user-menu/` (+ `stub.ts`) | Dev preview of the user menu with stubbed auth and fetch. Same gate. If removed, the `previewUser` prop in `UserMenu.tsx` (documented as "for the dev-only /dev/user-menu preview") becomes dead too, and I'd remove it in the same batch. |
| D4 | `src/components/DevMobileAudit.tsx` + `src/lib/mobile-audit.ts` | A dev-only `window.__mobileAudit()` helper mounted in `layout.tsx` behind `NODE_ENV==='development'`. Still works. Keep it if you use it when checking mobile layouts. |
| D5 | **video-demo (main checkout, uncommitted — NOT touched)** | See the section below. |

### Video-demo experiment (main checkout, read-only report)
The main checkout is on `main` @ `885ca08` (old: PR #3), with uncommitted changes:
- **New (untracked):** `src/app/dev/video-capture/` (page, `video-capture.tsx` 149 lines, `save/route.ts` — a dev route that saves captured frames), `src/app/dev/video-review/` (page + 76-line viewer), `src/lib/video-demo.ts` (53 lines of fixture data: 7 demo exam scores 96→138, a demo official score of 136, per-section results).
- **Modified (9 tracked files, +93/−21):** `package.json` + lockfile (adds devDep `html-to-image`), `next.config.ts` (`devIndicators: false`), `layout.tsx` (`suppressHydrationWarning`), `dashboard-context.tsx` (`?demo=video` injects fixture data, dev only), and `results/[sessionId]`, `stats`, `StatsCard`, `OfficialScoresSection` (switch to demo data).
- It's a local "film the app with fake data" harness. Everything is gated on `NODE_ENV==='development'` + `?demo=video`.
- ⚠️ It's built on a **very old base** (`885ca08`). Most of the files it changes have moved a lot since (stats redesign, official-score, a11y), so a straight commit or rebase would conflict.
- **Options:** (a) discard; (b) keep it local as is; (c) I move it to a branch `experiment/video-demo` (commit there from a copy, without touching your checkout) so it's saved but not in main. **Your call — I won't act on it.**

### Screens / features
| # | Item | Evidence |
|---|------|----------|
| F1 | `/admin` (+ `/api/admin/check`, `/api/questions/generate`, `src/lib/ai.ts`, `openai` dep) | No link in the UI. You can only open it by URL (and `robots.ts` disallows it). It is gated by `isAdmin` server-side. Its job is generating questions with AI. Recommendation: **keep** (an admin tool reached by URL by design). If removed, the `openai` dependency would only be needed by `scripts/`. |
| F2 | Two Supabase keepalives: Vercel cron `/api/cron/keep-alive` (daily, needs `CRON_SECRET`) **and** GitHub Action `keepalive.yml` (Mon/Thu) | They do the same job. If `CRON_SECRET` isn't set in Vercel, the cron returns 401 and only the GitHub Action is actually keeping the DB awake. Recommendation: keep both unless you know which one works; just noting the duplication. |
| F3 | Home "טיפים אסטרטגיים" row | **Still on main**: `src/app/page.tsx:119`. PR #6 (`claude/remove-home-strategy-tips`) is **open, not merged**. If you want it gone, merge #6 rather than me redoing it here. |

### Committed generated files
| # | Item | Evidence |
|---|------|----------|
| G1 | `public/sw.js`, `public/workbox-6c8e768e.js`, `public/worker-573476a74957a993.js` | next-pwa writes these on every `next build` (knip: unused; eslint already ignores them). The committed copies are stale build output. Vercel regenerates them at deploy, and any local build dirties the tree. Proposal: `git rm --cached` them and add them to `.gitignore`. Low risk, but it touches PWA delivery, so it's your call. `worker/index.js` is the **source** for the custom worker and stays. |

### Scripts (one-off DB ops; not part of the app or tsconfig)
knip flags all of `scripts/` as unreachable. That's expected, since they're run by hand with `npx tsx`. Status:
| # | Script | Status |
|---|--------|--------|
| SC1 | `simulate-adaptive-exams.ts` | Isolated simulation harness (2026-09-22), no references. **You mentioned a "stale sim harness" was removed, but this one is still on main.** If this is the one you meant, approve its removal. |
| SC2 | Already-applied one-offs: `archive-replace-vocab.ts`, `insert-vocab-batch.ts`, `swap-vocab-levels.ts`, `reset-vocab-categories.ts`, `clean-vocab-definitions.ts`, `backfill-part-of-speech.ts`, `exclude-contradictory-items.ts`, `polish-explanations.ts` (+ `scripts/lib/vocab-rules.ts`, `scripts/data/*`) | Each one wrote a backup and has been applied (TASKS.md records this). They document how prod data got to its current state, and the backups in `backups/` are their revert input. Recommendation: **keep** (they are small, about 1.5 MB with data). |
| SC3 | June-era AI scripts: `audit-questions.ts`, `recalibrate-vocab.ts`, `seed-bulk-questions.ts` | Last touched 2026-06. Still mentioned in SPEC. Could be removed; low value either way. |
| SC4 | `seed-content-2026-08-05*.sql` (37 files), `calibration-audit.sql`, `test-exam-transaction.py`, `generate-icons.mjs`, `backup-content.ts` | Seeds have been applied (SPEC changelog 08-05). `generate-icons.mjs` was used for PR #11 icons and is worth keeping. `backup-content.ts` is the only content-backup tool, so keep it. |

### Backups (`backups/`, 46 files, 23 MB, all committed)
| # | Item | Evidence |
|---|------|----------|
| B1 | `content-2026-07-07…json`, `content-2026-09-16…json` (12.9 MB) | `backup-content.ts` describes these as "the only copy" of the hand-curated content. **Recommend keep.** |
| B2 | `distractor-batch-01…24`, `distractor-L2fix`, `explanations-*`, `part-of-speech-*`, `vocab-*`, `exam-eligible-*` | Revert snapshots written by the SC2 scripts before each prod data change (2026-09-25…30). Safe to drop only if you're sure you'll never need to roll back those edits. Git history keeps them either way, so removing them from the tree is recoverable. |

### Stale / historical docs
| # | Item | Evidence |
|---|------|----------|
| DOC1 | `supabase-schema.sql` | 2026-06 base schema. It still defines a `leaderboard` **view** over `auth.users` (removed and replaced long ago) and contradicts the live DB (AUDIT.md L8, #12). SPEC itself calls it "not necessarily in sync". Options: delete it (migrations + live DB are the truth), or keep it with a header saying it's historical. |
| DOC2 | `README.md` | Unedited create-next-app boilerplate (mentions Geist and `app/page.tsx`). Option: replace with a 10-line real README (what the app is, `npm run dev/test/build`, pointer to `docs/SPEC.md`). |
| DOC3 | `AUDIT.md`, `A11Y-AUDIT.md`, `TASKS.md` at repo root | Finished reports and task log. Option: move them to `docs/` (or leave them). TASKS.md mentions the leaderboard as historical log lines, which is fine. |

---

## Git housekeeping — done

Remote branches deleted. For each one I confirmed that its PR is merged and that `git branch -r --merged origin/main` lists the branch (or, for `fix/audit-top3`, that `git cherry` shows every commit is patch-equivalent in main):

| Branch | PR |
|---|---|
| claude/amirnet-logo-redesign-9ab1e9 | #11 |
| claude/app-accessibility-audit-769702 | #18 |
| claude/double-tap-zoom-fix | #5 |
| claude/mixed-practice-improvements-77e4df | #12 |
| claude/profile-ui-redesign-b452a7 | #9 |
| claude/stats-screen-redesign-audit-9174f0 | #4 |
| claude/streak-badge-refine | #10 |
| claude/vocabulary-deck-cache-bug-d1334a | #15 |
| fix/audit-top3 | #2 (all commits patch-equivalent in main) |

Worktree `amirnet-scoring-diagnosis-c32c76` removed. It had no tracked or untracked changes (only the globally ignored `.claude/settings.local.json`) and no commits beyond `origin/main` (branch tip `2af8172` = PR #15 merge). Its local branch was deleted with `git branch -d`, which refuses to delete an unmerged branch.

**Left alone:**
- `claude/remove-home-strategy-tips`: PR #6 is still **open**.
- `codex/secure-guests-and-reliability` and `fix/distractor-repetition`: both are fully merged into main, but no PR was ever opened for them. Say the word and I'll delete them. `fix/distractor-repetition` is also checked out in worktree `bold-allen-bec1d6`.
- The main checkout: not touched, no pull.

---

## Approvals / removals log

**Approved:** S1, S2, S3, S6, S8 (delete) · S7 (doc fix) · S4–S5 minus `next-pwa` · G1 · SC1 (if it's the stale harness) · DOC1 header · DOC3 move · video-demo → `experiment/video-demo` · PR #6 merge · delete the 2 PR-less merged branches.
**Kept by decision:** D1–D4, F1, F2, SC2–SC4, B1 (B2 not addressed, so kept), README (DOC2).

| Batch | Commit | Removed / changed |
|---|---|---|
| 1 | `29d47c0` | S1 `ui/button.tsx`, S2 `ui/sonner.tsx`, S3 `lib/utils.ts`, S6 5 boilerplate SVGs, S8 two test params → `_s`, SC1 `scripts/simulate-adaptive-exams.ts` |
| 2 | `e85d218` | 10 deps: `@base-ui/react`, `class-variance-authority`, `clsx`, `tailwind-merge`, `sonner`, `next-themes`, `@hookform/resolvers`, `react-hook-form`, `date-fns`, `workbox-window` |
| 3 | `8b7ead8` | G1: `git rm --cached` on `public/sw.js`, `workbox-*.js`, `worker-*.js` + `.gitignore` entries |
| 4 | `417ccec` | S7 SPEC leaderboard fixes · DOC1 header on `supabase-schema.sql` · DOC3 `AUDIT.md`, `A11Y-AUDIT.md`, `TASKS.md` → `docs/` (image link fixed) |

**SC1 confirmation.** It was the stale harness. It drove the *old* exam orchestration: `estimateThetaMLE` plus `routeNextDifficulty` level routing. The live `exam/answer` route now uses EAP, `chooseRouteTarget` cut-targeting and information-based item planning (`5a8db25`). The scoring/calibration work's simulation is in `src/lib/calibration.test.ts` ("cut-score targeting (simulation)", 20,000-student measurements). No other simulation file exists anywhere in git history or in any worktree.

**Packages kept and why:**
| Package | Why kept |
|---|---|
| `next-pwa` | Kept by your decision. Note: `next.config.ts` actually imports **`@ducanh2912/next-pwa`**; nothing imports `next-pwa` (the old fork). It's safe to drop later if you want. |
| `@ducanh2912/next-pwa` | Generates the service worker (`next.config.ts`) |
| `shadcn`, `tw-animate-css` | `globals.css` does `@import "shadcn/tailwind.css"` and `@import "tw-animate-css"` |
| `openai` | `src/lib/ai.ts` (admin question generation) + scripts |
| `recharts` | `components/stats/VictoryPath.tsx` |
| `lucide-react`, `zod`, `@supabase/*`, `@upstash/*`, `next`, `react*` | Imported throughout the app or in `proxy.ts` |
| `postcss` (unlisted) | knip flags it as an *unlisted* dep in `postcss.config.mjs`. It comes in through `@tailwindcss/postcss`. Not changed. |

**Service worker after removals:** I deleted `public/sw.js`, `workbox-*.js` and `worker-*.js`, then ran a clean `npm ci` + `next build --webpack`. All three were regenerated, `sw.js` has the precache and the `NetworkOnly` API rule, and the SW registration is in the client chunks (`main-*.js`). After batch 3 a build leaves `git status` clean.

**Video-demo.** Committed as **local branch `experiment/video-demo` (`0380a61`)**, based on `885ca08`. I built it in a temporary worktree from a patch of your main checkout plus a copy of the 3 untracked paths, then removed that worktree. The main checkout is byte-for-byte unchanged (same `git status`, same diff md5 before and after). **Not pushed:** the repo is **public**, and `dev/video-capture/save/route.ts` hard-codes a local absolute path under `/Users/admin/Documents/Codex/…`. To publish it, run `git push origin experiment/video-demo`, ideally after replacing that path.

**Git (Phase 2):** deleted `origin/codex/secure-guests-and-reliability` and `origin/fix/distractor-repetition` (both 0 commits ahead of main).

**PR #6:** it conflicted with main because PR #18 changed `page.tsx` imports. I merged `origin/main` into the branch, kept main's imports minus `Lightbulb`, and pushed (`3818afd`). The diff against main is now just `page.tsx` (+2/−15). Locally: 680 tests, tsc, eslint and build all green.

## Verification log
**Baseline (before any removal, `f2ce8aa`):** vitest 66 files / 680 tests passed · `tsc --noEmit` exit 0 · `eslint .` 0 problems · `next build --webpack` succeeded (all routes listed). Side effect: the build rewrote the committed `public/sw.js`, which confirms G1. I reverted it.

| After batch | vitest | tsc | eslint | `next build` | sw.js regenerated |
|---|---|---|---|---|---|
| 1 | 66 files / 680 ✓ | 0 | 0 | ✓ | ✓ |
| 2 (clean `npm ci`) | 66 / 680 ✓ | 0 | 0 | ✓ | ✓ (deleted first) |
| 3 | 66 / 680 ✓ | 0 | 0 | ✓ | ✓ (deleted first; tree clean after) |
| 4 | 66 / 680 ✓ | 0 | 0 | ✓ | ✓ |

No item had to be reverted: every removal built and tested green on the first try. The final build lists 52 routes (pages + API). Every route in the baseline build output is still present, and no route was removed (the `/dev/*` pages are kept).

## Deploy / PR results

- **PR #6 merged** (`6dcc37b`, 2026-10-02 09:56 UTC):
  - CI: first run hit a flaky `next/font` Google Fonts fetch (`Cannot read properties of null` in the font loader). One rerun passed and no code changed.
  - Preview checked: the "טיפים אסטרטגיים" row is gone and there are no console errors.
  - Production deploy: `success`.
  - `https://amiret-prep.vercel.app/` checked: the row is absent from both the HTML and the screen.
- **Cleanup PR: [#19](https://github.com/maorfurman4/app-amiret-prep/pull/19).** Not merged; it's for your review.
  - Synced with main after #6 (`page.tsx` only) and re-verified green.
  - CI `test-and-build` passes and Vercel preview passes.
  - Preview checks:
    - Every live screen returns 200: `/`, `/practice`, `/vocabulary`, `/review-queue`, `/strategies`, `/tips` + 3 subpages, `/stats`, `/today`, `/diagnostic`, `/exam`, `/auth/login`, `/auth/reset-password`, `/admin`.
    - `/sw.js` is served (generated at deploy) and the service worker registers.
    - `manifest.json`, icons, `robots.txt` and `sitemap.xml` return 200.
    - `/dev/*` returns 404 in production (by design).
    - Removed `/file.svg` returns 404.
    - No console errors.
- Remote branch `claude/remove-home-strategy-tips` deleted after its merge.
