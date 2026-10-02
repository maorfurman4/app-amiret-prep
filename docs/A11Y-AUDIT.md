# A11Y-AUDIT — amiret-prep (134+)

**Standard:** WCAG 2.1 AA + IS 5568 (the Israeli standard adopts WCAG AA) · **Date:** 2026-10-02 · **Base:** `d89c834` (= main) · **Phase 1: read-only, no code changed.**

## How this was measured

- **Skill used:** `design:accessibility-review` (WCAG 2.1 AA checklist: contrast, keyboard, focus, target size, labels, name/role/value). No IS 5568-specific or RTL skill is installed, so none was used.
- **Environment (no production writes):** `next dev` from this worktree with a gitignored `.env.local` that points the browser's Supabase client at a local mock (`localhost:3100/sb`) and the server's at a dead port (`127.0.0.1:9`). A local proxy served every `/api/*` call from fixtures, so no request reached a database. To shape the fixtures I ran **two read-only SELECTs** on the production DB: one completed exam session (test traffic) and 40 vocabulary rows. Nothing was written.
- **Tools:** headless system Chrome (puppeteer-core, installed in a scratch folder rather than the project) running **axe-core 4.12** (tags wcag2a/aa, wcag21a/aa, best-practice) plus custom checks: rendered contrast, heading outline, landmarks, skip link, tap-target size (including `hit-44` pseudo-areas), horizontal overflow, a Tab walk recording the focus indicator, and scripted keyboard/ARIA probes for each interaction. Contrast is what axe measured on the rendered pixels, plus token pairs calculated with the WCAG formula.
- **Matrix:** 24 screens × {375 px, 1280 px} × {light, dark}, plus **320 px** (400% reflow) and **640 px** (= 200% browser zoom on a 1280 px window). The screens: home, streak celebration, exam picker, exam sections 1 / 3 (RC) / 4 (restatement) / 7 (experimental), results, review, practice picker, practice session, diagnostic, strategies, tips + its 3 sub-pages, stats, vocabulary (+ filter modal), today, review-queue, login, reset-password, and the profile popover (`/dev/user-menu`).
- **Limits:** no real screen reader (VoiceOver/NVDA) was run; SR behaviour is inferred from the computed accessibility tree. Before merge, do a 5-minute VoiceOver pass on the phone.

## Summary

| Severity | Count | Meaning |
|---|---|---|
| 🔴 Critical | 1 | Stops a keyboard user from finishing an exam section |
| 🟠 High | 10 | A core flow is unusable or misleading for SR or keyboard users, or it fails a Level A/AA criterion on a main screen |
| 🟡 Medium | 10 | Partial barrier, or a workaround exists |
| 🟢 Low | 5 | Polish / best practice |

---

## Findings (ranked)

### 🔴 Critical

| ID | Screen | Element | Issue (measured) | WCAG / IS 5568 | Fix |
|---|---|---|---|---|---|
| **C1** | Exam (in session) | `src/app/exam/[sessionId]/page.tsx:152-171` | The global `keydown` shortcut handler calls `preventDefault()` on **Enter/Space** whenever the current question is answered, whatever has focus. **Measured:** focus on "סיים פרק", then Enter or Space → **0 submits**, still on section 1 (a mouse click submits). Enter on a focused "יציאה מהמבחן" moves to the next question instead of opening the exit confirmation. Keyboard users cannot end a section, exit, go back, or change an answer. | 2.1.1 Keyboard (A) | Skip the Enter/Space shortcut when `e.target` is an interactive element (`button, a, input, [role=…]`), and call `preventDefault` only when actually navigating. Keep the 1–4 digit shortcuts. |

### 🟠 High

| ID | Screen | Element | Issue (measured) | WCAG | Fix |
|---|---|---|---|---|---|
| **H1** | Login, forgot-password | `src/app/auth/login/page.tsx:235-242, 302-339` | `<label>`s are not associated (no `htmlFor`/`id`). **Measured** accessible names: email = "your@email.com" (placeholder), password = "••••••••". The password `<label>` wraps the "שכחת סיסמה?" button. Errors (242, 334-339) have no `role=alert`, and fields get no `aria-invalid`/`aria-describedby` (measured after a failed login: none). The "לפחות 6 תווים" hint is not linked. The login/signup toggle doesn't expose which one is selected. | 1.3.1, 3.3.1, 3.3.2, 4.1.2 | `useId` + `htmlFor`; move the forgot link outside the label; `role="alert"` on errors; `aria-invalid` + `aria-describedby` (error + hint); `aria-pressed` on the toggle. |
| **H2** | Exam, diagnostic, practice, today, review-queue | `src/components/exam/QuestionCard.tsx:111-141` | Answer options are plain buttons. The chosen option is shown only by border/background (**measured**: no `aria-pressed`/`aria-checked`). In practice/review, right vs wrong is shown only by color plus icons marked `aria-hidden`. | 4.1.2, 1.3.1, 1.4.1 (non-visual) | `aria-pressed={isSelected}` on each option; when results show, add visually-hidden text ("תשובה נכונה" / "התשובה שלך, שגויה"). |
| **H3** | Practice (learn mode), vocab quiz | `QuestionCard.tsx:115` (`disabled={showResult}`), `src/app/vocabulary/page.tsx:1484` | Answering disables every option, so **focus drops to `<body>`** (measured). The keyboard user starts again from the top, and the result is never announced (measured: no live region). | 2.4.3, 4.1.3 | After answering, move focus to the explanation / "נכון!" panel (`tabIndex=-1`) and give it `role="status"`. Alternatively use `aria-disabled` so focus stays put. |
| **H4** | 18 of 24 screens | `src/app/layout.tsx`, `BackNav.tsx:28`, `BottomNav.tsx:46` | **No skip link** anywhere. `<main>` is missing on every BackNav page (axe `landmark-one-main` on 18 screens, `region` ×23 on home). There are two `<nav>` landmarks with no labels (axe `landmark-unique` ×13). On desktop, the sticky BackNav has 8 links ahead of the content. | 2.4.1 Bypass Blocks (A), 1.3.1 | Add a "דלג לתוכן הראשי" link in the layout (visible on focus) pointing to `#main`. Give each page's content wrapper `<main id="main">`. Label the navs `aria-label="ניווט עליון"` / `"ניווט ראשי"`. |
| **H5** | Vocabulary filter (all users of `ui/Modal`) | `src/components/ui/Modal.tsx:39-55` | No focus trap. **Measured:** after 14 Tabs focus leaves the dialog and lands on the page behind it (BODY, then "דף הבית", …). The background is not `inert`. Escape, initial focus and focus restore all work. | 2.4.3, 2.1.2 (dialog pattern) | Add Tab/Shift+Tab wrap-around like `UserMenu` already does, or set `inert` on `#__next` siblings while open. |
| **H6** | Exam, exam picker | `exam/[sessionId]/page.tsx:294-303, 374, 398, 433-446`; `src/app/exam/page.tsx:95-99` | Status messages are not announced. **Measured:** the "can't finish a section with blanks" warning has no role/live region. The same goes for the late-submission notice, the exit confirmation, the load/submit errors, the "שולח את הפרק…" spinner, and the exam-start error. | 4.1.3 Status Messages (AA) | `role="alert"` for errors and the blank-answer warning; `role="status"` for the submitting and late notices; move focus to the exit-confirm panel when it opens. |
| **H7** | Results, home, exam header | `src/types/exam.ts` (`SCORE_CLASSIFICATIONS` colors), `results/[sessionId]/page.tsx` per-type cards (`opacity-75`), `src/components/home/StreakBadge.tsx` (`text-exam-alt/85`), `SectionProgress.tsx:55` (`text-exam-alt/70`) | **Measured** text contrast, light theme: classification label "טווח מתקדמים א'" **2.91:1** (raw `text-yellow-600` #D08700, 20px bold); per-type % **4.15:1 / 3.40:1** (12px); "ימים ברצף" **4.18:1**; "תרגול חלופי" **3.32:1** (10px). Dark theme: no failures. | 1.4.3 (AA) | Map classifications to tokens (`text-exam-sage-strong / exam-accent / exam-alt / exam-wrong`, 5.7–10.8:1). Drop the opacity modifiers so they use the full token (amber on amber-bg = 5.70:1). |
| **H8** | Profile popover | `src/components/UserMenu.tsx:23, 26, 568` | Rows use `focus-visible:outline-none` with `bg-menu-hover` as the focus cue. **Measured:** the background doesn't change and the outline that remains is the base `outline-ring/50` (accent at 50% alpha on the white menu, ≈1.3:1 in dark mode and ≈2.6:1 in light). Inputs use `ring-menu-accent/30` (1.74:1). Focus is hard to see. | 2.4.7 (AA), 1.4.11 | `focus-visible:outline-2 focus-visible:outline-menu-accent` (10.8:1 on white) on rows and inputs. |

> **Correction (Phase 2):** on a *light* page the popover focus ring was already a clear navy. The base `:focus-visible` rule is unlayered, so it overrides the Tailwind `outline-none` utilities. The real failure was on *dark* pages, where the dark theme's pale accent (`#B7C9F1`) is painted onto the always-white menu (≈1.4:1).
| **H9** | Exam RC (section 3) | `QuestionCard.tsx:76` (`max-h-56 overflow-y-auto`) | The reading passage scrolls inside a box that can't take keyboard focus (axe `scrollable-region-focusable`, serious). In Safari a keyboard-only user **cannot read the rest of the passage**. | 2.1.1 (A) | `tabIndex={0}` + `role="region"` + `aria-label="קטע קריאה"` on the passage box. It already gets the global focus outline. |
| **H10** | Vocabulary | `vocabulary/page.tsx:1233, 1458` (and `1205`, which has `title` only) | Icon-only "speak" buttons have **no accessible name** (the screen reader says "button"). | 4.1.2 (A) | `aria-label={\`השמע הגייה של ${word}\`}`, the same wording as line 964. |

### 🟡 Medium

| ID | Screen | Element | Issue | WCAG | Fix |
|---|---|---|---|---|---|
| **M1** | Exam, practice section mode | `src/components/exam/ExamTimer.tsx:43-61`; `practice/page.tsx:643` | **Measured:** the timer has no role, label or live region, and the 10-second "הזמן עומד להיגמר!" warning is not announced. The time limit itself is essential (it simulates the real exam), so 2.2.1's exception applies, but the warning has to reach SR users. | 4.1.3, 1.3.1 | `role="timer"` + `aria-label="זמן שנותר בפרק"`; a separate sr-only `aria-live="assertive"` line that speaks only at 60 s and 10 s. |
| **M2** | Exam header, nav, pickers | `SectionProgress.tsx:30-60`; exam dots `exam/[sessionId]/page.tsx:460-474`; `BottomNav.tsx:83`; `BackNav.tsx:65`; review filter `review/[sessionId]/page.tsx:131`; practice count/difficulty/mode `practice/page.tsx:495, 539, 560`; vocab mode switch | Current or selected state is shown by color only. **Measured:** no `aria-current` anywhere and no `aria-pressed` on these toggles. A completed section shows a check (`aria-hidden`) in place of its number, so SR users get no number and no "done". | 4.1.2, 1.3.1 | `aria-current="page"` (nav tabs), `aria-current="step"` (section/question), `aria-pressed` (toggles), sr-only "הושלם". |
| **M3** | Exam (320 px), home, results | `exam/[sessionId]/page.tsx:449` nav row; glow layers `results/[sessionId]/page.tsx:134`, `ExemptionCard.tsx:95`, home | **Measured reflow at 320 px:** the exam nav row is 376 px wide in a 288 px box, so the page scrolls sideways by **32 px** (4 questions) or **72 px** (RC, 5 questions). Decorative glows overflow by 6 px (home) and 19 px (results), and by 5 px on results at 200% zoom. | 1.4.10 Reflow (AA) | Let the nav row wrap (dots on their own line under ~360 px) or reduce its gap/padding. Put `overflow-x-clip` on the glow wrappers. |
| **M4** | Several | exam exit `:325` 32×32, question dots 32×32, prev/next 36–42 px tall, "דלג על התרגול החלופי" 38; review header buttons 24–34 tall, mobile pills 28×28; vocab favorite **20×20**, speak 24×24; review-queue "תרגל" 36, trash 36×36; desktop BackNav links 26 tall, "בית" 16 | Tap targets under 44×44 (measured). Note that WCAG 2.1 AA has no target-size criterion (2.5.5 is AAA); the 44 px rule here is the project's own standard. | 2.5.5 (AAA) / project | Add the existing `hit-44` utility, which leaves the visuals unchanged. Check spacing between neighbouring dots. |
| **M5** | Vocabulary, today, strategies | `vocabulary/page.tsx` (words, definitions, examples: 0 `lang="en"`), `today/page.tsx`, `strategies/*` English examples | English text inside the Hebrew page has no `lang="en"`, so the screen reader reads English words with the Hebrew voice. That matters a lot in an English-learning app. `QuestionCard` already does this correctly. | 3.1.2 Language of Parts (AA) | Add `lang="en"` (plus `dir="ltr"` where missing) on English word, definition and example elements. |
| **M6** | Exam, results, review, practice session, diagnostic (answering) | page roots | No `<h1>` (axe `page-has-heading-one` on 8 screens). The results score and the exam title are styled divs. | 1.3.1, 2.4.6 | Make the existing visible title the `<h1>` (exam "סימולציית פרקי הליבה", review "סקירת מבחן"); on results, add an sr-only h1 "תוצאות המבחן", and on the practice session "תרגול: {type}". |
| **M7** | Login, reset, vocab search, official-score, exam-date | input classes (`border-exam-border`) | The only visible edge of an input is the border: **1.37:1** light / 1.59:1 dark against the surface. Score-field placeholders use `border-strong` (**1.99:1**). Focus rings at `accent/30` measure 1.69:1, but the focused border switches to the accent color (10:1), which carries focus visibility. | 1.4.11 (AA), 1.4.3 (placeholder) | Inputs: `border-exam-border-strong` (2.32:1 light, still under 3:1) is not enough, so this needs a token decision (see the question below). Placeholders: `text-exam-ink-soft`. |
| **M8** | Home streak, celebration, vocab stars | `rolling-number` span `aria-label="3"`, `vocabulary/page.tsx:27` | `aria-label` on a `<span>` with no role is prohibited (axe, serious) and many screen readers ignore it, so the streak count and difficulty stars can be lost. **Measured:** the celebration title text resolves to "23ימים ברצף", because the hidden digit tracks are included. | 4.1.2 | Use `role="img"` + `aria-label`, or an sr-only text sibling. |
| **M9** | Every screen with BottomNav | `BottomNav.tsx:97` | Mid-activity, the first tap on a tab only swaps the label to "לחץ שוב לצאת". That change isn't announced, so an SR user thinks the tap did nothing. | 4.1.3 | Add an sr-only `role="status"` that announces "לחץ שוב כדי לצאת מהתרגול". |
| **M10** | Exam picker, practice picker | `exam/page.tsx:102`, practice cards | The loading/disabled state after choosing a mode isn't announced (`disabled` only). This is minor next to H6, but it's the same fix. | 4.1.3 | `aria-busy` + status text. |

### 🟢 Low

| ID | Issue | Where | Fix |
|---|---|---|---|
| L1 | `scrollIntoView({behavior:'smooth'})` ignores reduced-motion (JS-driven, so the CSS override doesn't reach it) | `SectionProgress.tsx:25` | Use `behavior` = `matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth'`. |
| L2 | The home and login `<h1>` is the logo (name "134+"), which doesn't describe the page | `page.tsx`, `auth/login/page.tsx:359` | Add sr-only text to the h1: "134+ הכנה לאמירנ״ט" / "כניסה". |
| L3 | Single-key shortcuts (1–4, arrows) can't be turned off | exam, vocabulary | Low risk (no text fields on those screens). Either document them or scope them to focus inside the question. 2.1.4 (A). |
| L4 | The "⏸" emoji in the practice badge is read aloud | `ExamTimer.tsx:33` | `aria-hidden`. |
| L5 | The speed-practice per-question timer can't be extended | `practice/page.tsx` | Passes because the untimed "למידה" mode is an equivalent alternative. Mention it in the mode description. |

---

## What already passes (measured)

- **Language/direction:** `<html lang="he" dir="rtl">`. Exam questions, options and passages carry `lang="en" dir="ltr"`. Ranges are wrapped in `<bdi dir="ltr">`, so mixed Hebrew/English/number text renders in the right order (checked visually at 375 and 320 px).
- **Visible focus:** the global `:focus-visible` outline (2 px accent, **10.1:1** on paper) appeared on **every** tab stop on all 22 screens walked. The only exception is the UserMenu rows (H8).
- **Contrast, dark theme:** **0** axe contrast failures across 24 screens × 2 viewports. Key tokens: ink-soft 7.0–9.2:1, accent 7.7–9.0:1, amber 8.4:1.
- **Contrast, light theme:** body/token text passes (ink-soft 5.1–6.0:1, accent 9.2–10.8:1, wrong 5.8:1, sage-strong 7.6:1). The only failures are the opacity and raw-Tailwind cases in H7.
- **Reduced motion:** the global `prefers-reduced-motion` rule (`globals.css:391-398`) plus specific overrides (`:426-430, :478`) cover the streak/neon/achievement animations. The inline flashcard transitions are overridden by the `!important` rule. Only the JS smooth scroll is left (L1).
- **200% zoom (640 px):** no horizontal overflow on 23 of 24 screens (results: 5 px of decorative glow).
- **320 px:** 19 of 24 screens reflow cleanly (exceptions in M3).
- **Profile popover (prior work, verified):** `aria-haspopup="dialog"`, `aria-expanded`, `aria-controls`. Focus moves into the dialog, **Tab wraps inside** (measured an 8-stop cycle), and Escape closes and returns focus to the trigger. Fields are labelled with `aria-invalid`/`aria-describedby`, errors use `role="alert"`, the "נשמר" message is `aria-live`. Only the focus visibility needs work (H8).
- **Streak celebration:** native `<dialog>` + `showModal()`, autofocus on a named close button, Escape closes, labelled by its title.
- **`ui/Modal`:** `role=dialog`, `aria-modal`, `aria-labelledby`, Escape, initial focus on close, and focus restored to the trigger (measured). The focus trap is missing (H5).
- **`touch-action: manipulation`:** present app-wide in the base layer (`globals.css:347-351`). Pinch-zoom is not disabled (no `maximum-scale`).
- **Images/icons:** no `<img>` without alt; every visible lucide icon is `aria-hidden` (0 unlabelled SVGs, apart from the decorative Google mark inside a text button).
- **Already well wired:** stats (`aria-pressed` groups, `aria-expanded/controls`, `role=meter`), diagnostic `role=progressbar`, reset-password (`htmlFor` + `role=alert`), vocabulary filter chips (`aria-pressed` + count labels), exam question dots and review pills (names include "עוד לא ענית" / "נכונה/שגויה"), practice mix steppers (`role=group` + live value), and the PaceGauge (`aria-expanded`, `aria-live`).
- **Headings:** strategies, tips (+3), stats, today, review-queue, exam picker and diagnostic intro each have exactly one h1 and a logical h2/h3 order.
- **Tap targets at 375 px:** home, BottomNav tabs, practice, strategies, tips, stats, diagnostic, today, login, reset all ≥44 px (the `hit-44` utility is already in use).

## Decisions I need from you

1. **Which findings to fix?** I recommend **C1 + all of High + M1–M9** (M10 is folded into H6), plus L1/L2/L4. This is markup-only: no visual change except H7/H8 (slightly darker text and a stronger popover focus ring) and M3 (the exam nav row wraps below about 360 px).
2. **M7 input borders:** fixing 1.4.11 means a darker input border. Options: (a) add a new token `--exam-border-input` at ≥3:1 (≈ `#8C9590` light / `#74879A` dark), used **only** on text inputs; (b) `border-exam-ink-soft`, an existing token that is visibly heavier; (c) skip it (the label + placeholder still identify the field). I recommend (a).
3. **Preview DB:** this Supabase account has **one** project, so a Vercel preview almost certainly uses the **production DB**. I'll confirm this from the Vercel env settings before opening the PR and say so in it. Anything you do in the preview writes real rows.

---

# Phase 2: fix report

## What was approved

- **Approved:** C1, all High (H1–H10), and Medium/Low M1–M10, L1, L2, L4 and L5. The four visible changes (H7 contrast, H8 popover focus ring, M7 input-border token, and the wider M3 exam-nav stacking) were approved after a before/after review: [docs/a11y/before-after.png](a11y/before-after.png).
- **Excluded by agreement:** **L3** (single-key 1–4 shortcuts). Meeting 2.1.4 needs either a new on/off setting or shortcuts that only work while an answer has focus. The risk is low because those screens have no text fields.
- **Order applied:** C1 first, then High, then Medium/Low. Each batch was re-measured in headless Chrome against the same DB-isolated sandbox as Phase 1.

## What changed (file → before → after, measured)

| ID | Where | Before | After (measured) |
|---|---|---|---|
| C1 | new `src/lib/keyboard-shortcuts.ts` (+ unit test); `exam/[sessionId]/page.tsx`, `practice/page.tsx`, `review-queue/page.tsx`, `vocabulary/page.tsx` | Enter/Space on a focused "סיים פרק" → 0 submits; Enter on exit → next question | Enter → section 1→2 (1 POST); Space → same (separate run); Enter on exit → exit confirmation; Space on dot 3 → Q3; digit/Enter shortcuts with nothing focused still reach Q4. The same bug was also fixed in practice, review-queue and vocabulary (Space on "ידעתי" used to flip the card). |
| H1 | `auth/login/page.tsx` | names "your@email.com" / "••••••••"; errors silent | names "אימייל" / "סיסמה"; after a failed login both are `invalid` with the error as their description; `role=alert`; toggle `pressed` |
| H2/H3 | `components/exam/QuestionCard.tsx`, `vocabulary/page.tsx` | no selection state; focus → BODY after answering; result silent | `aria-pressed` on options; focus stays on the chosen option ("B alliance (התשובה שלך, שגויה)"); status "לא נכון. התשובה הנכונה: D"; the vocab quiz behaves the same way |
| H4 | `app/layout.tsx`, `BackNav.tsx`, `BottomNav.tsx`, every page | no skip link; no `<main>` on 18 screens; 2 unlabeled navs | 1st Tab = "דלג לתוכן הראשי" (150×46, visible); `<main id="main">` on every user-facing screen; navs "ניווט עליון" / "ניווט ראשי" |
| H5 | `components/ui/Modal.tsx` | focus left the dialog after 14 Tabs | 0 of 20 Tabs left it; Shift+Tab wraps; Escape → focus back on "סינון" |
| H6 | `exam/[sessionId]/page.tsx`, `exam/page.tsx` | warnings/errors silent | `role=alert` / `role=status`; exit confirmation moves focus to "המשך במבחן" |
| H7 | `types/exam.ts`, results, `StreakBadge.tsx`, `SectionProgress.tsx` | 2.91 / 3.32 / 3.40 / 4.15 / 4.18 : 1 | exam tokens (amber on surface 6.4:1, amber on amber-bg 5.70:1, sage-strong on sage-bg 7.56:1); **axe: 0 contrast failures**, light + dark |
| H8 | `globals.css` (`[data-menu-surface]`), `UserMenu.tsx` | dark page: pale outline on white menu (≈1.4:1) | navy `--menu-accent` outline (10.8:1) on both themes; light page unchanged |
| H9 | `QuestionCard.tsx` | passage not reachable by keyboard | Tab reaches "קטע קריאה"; arrows/PageDown scroll 274px; 2px focus outline |
| H10 | `vocabulary/page.tsx`, `today/page.tsx` | 4 nameless speak buttons | 0 unnamed icon buttons |
| M1 | `ExamTimer.tsx`, `practice/page.tsx` | timer silent | `role=timer` "זמן שנותר בפרק: 3 דקות ו-50 שניות"; announces "נותרה דקה…" and "נותרו 10 שניות לסיום הפרק" (measured with a 9 s deadline) |
| M2 | nav, exam/practice/review steps, toggles, `SectionProgress.tsx` | state shown by color only | `aria-current` page/step; `aria-pressed` toggles; "פרק 1, הפרק הנוכחי:" etc. |
| M3 | exam nav (container query), results/home `overflow-x-clip` | 320px: 72px sideways scroll; 375px RC: 17px; glows 6–19px | **0px** at 320/375/640 on every screen |
| M4 | `hit-44` on exam, review, vocab, review-queue, desktop nav, AuthCTA | 20–42px targets | no target under 44px on any screen except the desktop review sidebar (excluded: its 30px buttons sit 4px apart, so a 44px hit area would steal clicks) |
| M5 | vocabulary, today, strategies (`RichText` + guides) | English read with the Hebrew voice | `lang="en"` on words, definitions, examples and English runs |
| M6/L2 | exam, review, diagnostic, practice, results, logo h1s | no h1 on 8 screens; logo-only h1 | one h1 per screen; "134+: הכנה לאמירנ\"ט" |
| M7 | `--exam-border-input` `#7E8782` / dark `#74879A`, `--menu-border-input` | 1.37:1 (light) / 1.59:1 (dark) | 3.16–3.70:1 / 3.46–4.54:1 against surface, paper and paper-alt |
| M8 | `AchievementMotion.tsx`, vocab `StarRow`, diagnostic, `StatsHero` | `aria-label` on role-less elements | sr-only text / `role="img"`; 0 prohibited labels |
| M9/M10 | `BottomNav.tsx`, exam & practice pickers | silent "לחץ שוב" / loading | `role=status` messages, `aria-busy` |
| L1/L4/L5 | `SectionProgress.tsx`, `ExamTimer.tsx`, practice modes | smooth scroll under reduced motion; "⏸" read aloud | instant scroll with reduced motion; emoji `aria-hidden`; the speed mode points to "למידה" |

## Verification

- **Matrix re-run** (24 screens × 375/1280 × light/dark + 320px + 640px = 200% zoom):
  - axe: **0 violations** on every user-facing screen. One axe best-practice note remains: in dark mode only, `region` flags the skip link itself, which is a pattern exception and not a WCAG criterion.
  - Horizontal overflow: **0px** at 320, 375 and 640 on all screens.
  - Contrast: **0 failures** in light and dark.
  - `/dev/*` preview pages were not changed; they don't ship to users.
- **Regression caught and fixed during verification:** the new sr-only step labels briefly made exam pages scroll sideways by about 222px at 375px. The strip is now `relative`; re-measured at 0px.
- **Keyboard / SR wiring:** C1, H1–H10 and M1–M10 re-probed on the final code (values in the table above).
- **Tests and build:** `tsc` clean, `eslint` clean, **vitest 680/680** (+5 keyboard-shortcut unit tests, +6 render tests asserting roles and labels in `src/components/a11y-wiring.test.ts`), `next build` OK.
- **Note, unchanged behavior:** on the exam page Chrome starts Tab at the question, because the loading placeholder is replaced in place. This was the same in the baseline and is arguably right for an exam; the skip link and header are still reachable.
- **Not done here:** a real VoiceOver/NVDA pass. The owner will do VoiceOver on a phone before merge.
