# 134+ — אפיון מלא של האפליקציה (Full System Specification)

> מסמך זה מתאר את האתר **134+** (הכנה למבחן אמירנ"ט) ברמת פירוט מלאה: כל דף, כל API, כל טבלה, כל אינטגרציה, כל החלטת מוצר והסיבה לה, וכל בעיה ידועה. הוא נכתב כדי שכל מי שקורא אותו (אדם או סוכן קוד) יוכל לעבוד על המערכת בלי ידע מוקדם.
> מעודכן ל-**2026-09-16**, קומיט `a2bdd6e` ב-`main`. כל עובדה כאן אומתה מול הקוד וה-DB בפועל, לא מהזיכרון.

---

## 0. תקציר מנהלים

- **מה זה:** אתר תרגול והכנה למבחן **אמירנ"ט** (המבחן הממוחשב באנגלית של המרכז הארצי לבחינות ולהערכה — נית"ה). המטרה המוצהרת: להביא את המשתמש לציון **134+** = פטור מלא מקורסי אנגלית באוניברסיטה.
- **מה יש בו:** סימולציית מבחן מלא אדפטיבית (IRT 3PL, מנוע CAT רב-שלבי, טיימרים קשיחים לפי נית"ה), תרגול ממוקד לפי סוג שאלה/רמה, אבחון מהיר, חזרה מרווחת על טעויות (Anki-style), אוצר מילים (1,158 מילים, כרטיסיות/חידון/חידון בזמן), סטטיסטיקות ומעקב מוכנות, לוח מובילים, מדריכי אסטרטגיה, streak יומי, PWA.
- **עקרון יסוד — Guest-first:** הכל עובד בלי חשבון. כל מבקר מקבל UUID ב-localStorage (`amiret_guest_id`). הרשמה (Google / אימייל) היא אופציונלית, וברגע ההתחברות כל ההיסטוריה של האורח **ממוזגת** לחשבון (`/api/auth/merge-guest`).
- **היקף מוצרי (החלטת בעלים, קבועה):** **רק** הכנה לאמירנ"ט/אמיר"ם. אין כלי כתיבה, אין פיצ'רים מחוץ למבחן, אין AI בזמן מבחן/תרגול. (ניסיון להוסיף סימולטור כתיבה נדחה באמצע הבנייה.)
- **סטאק:** Next.js 15 App Router + TypeScript + Tailwind v4, Supabase (Postgres + Auth + Storage), Vercel (bom1), Upstash Redis (rate-limit), GitHub Actions (CI + keepalive).

---

## 1. סטאק, ריפו ופריסה

| פריט | ערך |
|---|---|
| ריפו | `github.com/maorfurman4/app-amiret-prep`, ענף `main` = פרודקשן (auto-deploy) |
| מסלול מקומי | `/Users/admin/לימוד אנגלית/amiret-prep` (clone ישיר) |
| פרודקשן | `https://amiret-prep.vercel.app` |
| Framework | Next.js (App Router, `--webpack` ב-dev וב-build), React 19, TypeScript strict |
| UI | Tailwind CSS v4 (`@theme` ב-`globals.css`), shadcn (`components/ui/button`, `sonner`), `lucide-react`, `next-themes` (לא בשימוש פעיל — ה-theme מנוהל ידנית, ראה §6.1), `recharts` (גרפים בסטטיסטיקות), `tw-animate-css` |
| Fonts | Geist (`next/font/google`) חשוף כ-`--font-geist`; `--font-sans`/`--font-heading` ב-`globals.css` מפנים אליו (תוקן 2026-09-16 — לפני כן היה self-reference והאתר רונדר ב-Times) |
| PWA | `@ducanh2912/next-pwa` — `public/sw.js` נוצר בבנייה (`skipWaiting: true`), מכובה ב-dev. `public/manifest.json` (שם "134+", RTL, `standalone`, אייקונים 192/512 maskable). `PwaUpdater` מציג באנר "גרסה חדשה זמינה" במקום רענון כפוי |
| בדיקות | `vitest` — `src/lib/adaptive.test.ts` (45 בדיקות יחידה על מנוע ה-IRT, ניקוד, ניתוב, מבנה המבחן) |
| Lint | `eslint` + `eslint-config-next` (יש חוב lint ישן — ראה §14) |
| CI | `.github/workflows/ci.yml` — על push ל-main ו-PR: `vitest run` + `next build` (עם ערכי NEXT_PUBLIC_ placeholder) |
| Vercel | `vercel.json`: `regions: ["bom1"]` (מומבאי — צמוד ל-Supabase `ap-south-1`), cron יומי `0 6 * * *` → `/api/cron/keep-alive` |
| Middleware | `src/middleware.ts` — rate-limit לפי IP על `/api/*`: 120 בקשות / 60 שניות (sliding window) דרך Upstash Redis; fallback in-memory אם אין env |

### 1.1 סקריפטים (`package.json`)
`dev` = `next dev --webpack` · `build` = `next build --webpack` · `start` · `lint` = `eslint` · `test` = `vitest run`

### 1.2 קבצי עזר בריפו
- `supabase-schema.sql` — סכמה בסיסית (לא בהכרח מסונכרנת עם ה-DB החי; ה-DB החי הוא המקור, ראה §8).
- `scripts/` — `audit-questions.ts` (ביקורת בנק), `backup-content.ts` (גיבוי תוכן ל-JSON, דורש service-role), `recalibrate-vocab.ts`, `seed-bulk-questions.ts`, `calibration-audit.sql`, ו-~37 קבצי `seed-content-2026-08-05-*.sql` (הזרעת בנק השאלות הגדול).
- `backups/content-2026-07-07T12-30-00-000Z.json` — גיבוי חיצוני יחיד של התוכן (990 שאלות/58 קטעים/1158 מילים נכון לאז). **Supabase Free אין לו PITR** — זה הגיבוי היחיד, והוא ישן (הבנק גדל פי ~7 מאז).
- `AGENTS.md` / `CLAUDE.md` — הנחיות לסוכני קוד (Next.js גרסה חדשה — לקרוא `node_modules/next/dist/docs/` לפני כתיבת קוד).
- `README.md` — ברירת המחדל של create-next-app, לא עודכן.

---

## 2. אינטגרציות ושירותים חיצוניים

| שירות | תפקיד | פרטים / גישה |
|---|---|---|
| **Supabase** (פרויקט `pxksqbuqfwbrluuiyedp`, אזור `ap-south-1`, Free tier, Postgres 17) | DB + Auth + Storage | חשבון הדשבורד: **edenel-s** (ארגון "edenel-s's Org", פרויקט "edenel-s's Project") — לא המייל של הבעלים. Auth providers: Google OAuth + Email/Password (אישור מייל **מופעל**). אין SMTP מותאם → מיילים דרך המיילר המובנה (מגבלה ~2–4 מיילים/שעה, תבנית גנרית). Storage: bucket ציבורי `avatars`. |
| **Vercel** | הוסטינג + Serverless (bom1) + Edge Middleware + Cron | חשבון אישי `maorfurman4s-projects`. ה-MCP connector של Vercel מחזיר 403 על הסקופ הזה — לוגים/env vars/Redeploy נעשים ידנית בדשבורד. ל-Preview deploys חייבים env vars בסקופ Preview (תוקן 2026-09). |
| **Upstash Redis** (דרך Vercel Marketplace, אזור fra1) | rate limiting משותף בין instances | env: `KV_REST_API_URL`, `KV_REST_API_TOKEN` (שמות legacy של Vercel KV). ייבוא `@upstash/redis/cloudflare` (build ל-Edge). אומת בעומס: 150 בקשות במקביל → 57×200 + 93×429. |
| **GitHub Actions** | CI + keepalive | `keepalive.yml`: שני וחמישי 06:00 UTC, `curl` ל-REST של Supabase עם ה-anon key (ציבורי ממילא) — מניעת auto-pause של Free tier (קרה ב-2026-08-03). |
| **Google OAuth** | כניסה | דרך Supabase; `redirectTo = /auth/callback?next=...`; `flowType: 'implicit'` (הטוקנים ב-hash). |
| **OpenAI** (`openai` SDK, GPT-4o) | **רק** לפאנל אדמין ליצירת שאלות (`/api/questions/generate`) | לא נקרא בזמן מבחן/תרגול. `lib/ai.ts` מאותחל lazy כדי לא להפיל build בלי מפתח. פונקציית הסברי-טעויות ב-AI **נמחקה** (2026-09, קוד מת). |

### 2.1 משתני סביבה
| שם | היכן | תפקיד |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` | לקוח+שרת | חיבור Supabase (anon) |
| `SUPABASE_SERVICE_ROLE_KEY` | שרת בלבד | כל הקריאות ל-DB בשרת (עוקף RLS). ב-`.env.local` היה `placeholder` עד 2026-09-16; עכשיו אמיתי. |
| `ADMIN_EMAILS` | שרת | רשימת מיילים מופרדת בפסיקים המורשים ל-`/admin` ו-`/api/questions/generate` |
| `CRON_SECRET` | שרת | Bearer לאימות ה-cron (`/api/cron/keep-alive`) |
| `KV_REST_API_URL`, `KV_REST_API_TOKEN` | Edge | Upstash |
| `OPENAI_API_KEY` | שרת | אדמין בלבד |

**כלל Vercel:** env var חדש/משתנה לא חל על deployment קיים — צריך Redeploy או push.

---

## 3. מודל הזהות (Guest-first) והאימות

### 3.1 אורח
- בביקור ראשון בכל אחד מהדפים `/exam`, `/practice`, `/review-queue`, `/vocabulary`, `/diagnostic`, דף הבית — נוצר `amiret_guest_id` (UUID v4) ב-localStorage (`lib/guest.ts::getOrCreateGuestId`, וגם inline בדפים ישנים).
- ה-UUID הזה נשלח כ-`guestId` (query/body) לכל ה-API, ומשמש כ-`user_id`/`guest_id`/`user_key` ב-DB.
- **החלטה:** `exam_sessions.user_id` מכיל **גם** UUID של אורח **וגם** UUID של משתמש רשום, באותה עמודה. `review_queue` לעומת זאת מפריד `guest_id` (text) מ-`user_id` (uuid). `user_question_history`/`user_passage_history` משתמשים ב-`user_key` (text) לשניהם.

### 3.2 משתמש רשום
- Supabase Auth, session ב-**localStorage** (לא cookies). לכן השרת לומד מי המשתמש דרך `Authorization: Bearer <access_token>` — `lib/auth-fetch.ts::authFetch` מצרף אותו לכל קריאה; אורחים פשוט לא שולחים header.
- `lib/supabase-server.ts::getServerClients()` מחזיר `{ supabase (service-role, לכל השאילתות), user (מ-bearer, או מ-cookies כ-fallback) }`. **דפוס חובה** בכל route: זהות מ-`user`, נתונים דרך ה-service client.
- מיזוג אורח→חשבון: `/api/auth/merge-guest` נקרא אחרי כל התחברות (callback של OAuth ולוגין אימייל). מעביר `exam_sessions`, `review_queue` (עם dedup), היסטוריית שאלות/קטעים, ומחשב מחדש `user_stats` + `leaderboard`. אידמפוטנטי. **אבטחה (2026-09):** דוחה `guestId` שהוא בעצם id של משתמש רשום (`auth.admin.getUserById` → 403), אחרת משתמש יכול היה "לגנוב" היסטוריה של אחר.

### 3.3 מסכי אימות
| נתיב | תפקיד |
|---|---|
| `/auth/login` | כניסה עם Google / אימייל+סיסמה (טאבים כניסה/הרשמה, מינימום 6 תווים), "שכחת סיסמה?" (שולח `resetPasswordForEmail` עם redirect ל-`/auth/callback?next=/auth/reset-password`), מצב "כבר מחובר" עם יציאה. תומך `?next=` לחזרה לדף המקור. הרשמה: אם Supabase החזיר session (אישור מייל כבוי) — נכנס מיד; אחרת "בדוק מייל". |
| `/auth/callback` | קולט את ה-hash (`detectSessionInUrl`), על `SIGNED_IN` → merge-guest + redirect ל-`next`; על `PASSWORD_RECOVERY` → `/auth/reset-password`; אם ה-hash מכיל `error=` (קישור פג/משומש) → מיד למסך המתאים במקום להמתין 6 שניות. ה-hash נקרא סינכרונית ב-`useState` initializer כי supabase-js מוחק אותו אחרי עיבוד. |
| `/auth/reset-password` | (חדש 2026-09-16) ממתין לסשן שחזור; טופס סיסמה חדשה + אימות; `auth.updateUser({password})`; מצבים: בודק / טופס / הצלחה / "הקישור אינו תקף" (אחרי 4 שניות בלי סשן). אומת מקצה לקצה עם משתמש-בדיקה זמני. |

### 3.4 פרופיל (`UserMenu`)
תפריט בדף הבית: שם תצוגה (`/api/profile/update-name` → `user_stats` + `leaderboard`), אווטאר (`/api/profile/upload-avatar` POST/DELETE → bucket `avatars`, `user_metadata`, `user_stats`, `leaderboard`; מחיקה מחזירה לראשי תיבות, לא לתמונת OAuth), שינוי סיסמה, קישור לסטטיסטיקות, יציאה.

---

## 4. מודל המבחן — אמירנ"ט כפי שמומש

### 4.1 מבנה (`src/types/exam.ts::SECTION_CONFIGS`)
| פרק | סוג | שאלות | זמן | הערה |
|---|---|---|---|---|
| 1 | השלמת משפטים | 4 | 4:00 | פרק ראשון תמיד ברמה 3 |
| 2 | השלמת משפטים | 4 | 4:00 | |
| 3 | הבנת הנקרא | 5 | 15:00 | קטע אחד + 5 שאלות |
| 4 | ניסוח מחדש | 3 | 6:00 | |
| 5 | ניסוח מחדש | 3 | 6:00 | |
| 6 | השלמת משפטים | 4 | 4:00 | |
| 7 | השלמת משפטים | 4 | 4:00 | **ניסיוני** — יכול רק להעלות ציון (עד +2), ניתן לדלג |

סה"כ מנוקד: 23 שאלות, 39 דקות — **תואם בדיוק** למבנה הרשמי (אומת מול נית"ה). **פער מכוון:** הפרק הניסיוני האמיתי (מ-17.3.25) הוא 1–2 פרקים מסוגים חדשים (האזנה/דקדוק/כתיבה); אצלנו הוא השלמת משפטים. הבעלים החליט להשאיר כך.

### 4.2 מנוע אדפטיבי (`src/lib/adaptive.ts`)
- מודל **3PL IRT**: `P(θ) = c + (1-c) / (1 + e^{-a(θ-b)})`. כל שאלה ב-DB נושאת `a` (0.51–2.5), `b` (-2.69–2.79), `c` (קבוע 0.25 — ניחוש מ-4 אפשרויות).
- **`a` קבוע (2026-09-23):** המנוע מתעלם מה-`a` השמור ומשתמש ב-`BASELINE_A = 1.2` לכל פריט (`itemIrtParams` ב-`adaptive.ts` — כל אומדן θ עובר דרכה). ה-`a` השמור הומצא בזמן כתיבה ולא נמדד, ונתן לשאלות משקל לא שוויוני בלי בסיס. העמודה נשארת כמות שהיא עד כיול מבוסס-נתונים מטבלת `responses`.
- אומדן θ אחרי כל פרק, **מצטבר** על כל הפרקים המנוקדים: MLE (Newton) עם fallback ל-EAP (41 נקודות) כשאין פתרון (הכל נכון/הכל שגוי).
- **ניתוב מבוסס מידע (2026-09-23):** הפרק הבא מורכב מהפריטים עם **מידע פישר** מקסימלי בנקודת יעד (`pick_informative_items` / `pick_informative_passage`, `lib/item-selection.ts`), לפי הקושי המכויל — לא לפי רמה 1–5. בחירה randomesque (אקראית מתוך 3× הנדרש המובילים; שוויון נשבר אקראית) — 30/30 סטים שונים בבדיקה. לא-נראים קודם; אין יותר איפוס היסטוריה. פרק 1: θ = 0.
  - **יעד:** θ לניתוב = EAP (יציב אחרי 4 פריטים; ה-MLE נשאר לציון). מפרק 5 ואילך (הכרעה) — **ציון החתך θ = 1.7 (134)** כל עוד הוא בטווח 2·SE מ-θ̂; אחרת θ̂. היעד והסיבה נרשמים ב-`theta_history` (`target_theta`, `target_reason`, `route_theta`, `route_se`).
  - **ממצא סימולציה (20K/מדיניות):** כיוון לחתך ניטרלי בפועל — 71.56% מול 71.10% סיווג נכון ליד החתך (±12 נק'), 88.58% מול 88.91% באוכלוסייה. ב-23 פריטים ה-SE (~0.45 θ ≈ 9 נק') שולט; ~29% מהנבחנים בטווח ±12 מהחתך יסווגו שגוי בכל מדיניות ניתוב.
  - `routeNextDifficulty` נשאר רק לתוויות רמה ב-UI (תרגול, סטטיסטיקות, אבחון).
- **כיול פריטים (Elo, Pelánek 2016):** `questions.b_calibrated` (הקושי שהמנוע משתמש בו; `itemIrtParams` מעדיף אותו) נפרד מ-`b` (הקושי שנכתב — prior קבוע) ומ-`difficulty_level` (הרמה הסטטית). `b ← b + K0/(1+n/N0)·(P−y)`, K0 = 0.4, N0 = 20, חסום ±4; `calibrate_from_responses` מיישם אטומית (נעילת שורה לכל פריט), זהה ל-`eloStep` עד 10 ספרות. רק: תשובה (לא ריקה), הקשר exam/practice/diagnostic (לא review), תשובה ראשונה של התלמיד לפריט, תלמיד עם ≥10 תשובות בהיסטוריה, לא ניחוש מהיר (<5% מהתקציב). θ לכיול: EAP מההיסטוריה **לפני** התשובות (ובמבחן — בלי המבחן עצמו). סימולציה: משחזר קושי אמיתי ±0.3 מתוך 400 תלמידים גם כשנכתב שגוי ב-1.5.
- **הסתברות פטור:** בסיום מבחן — `theta_se = 1/√I(θ̂)` ו-`p_exempt = Φ((θ̂ − 1.7)/SE)` נשמרים ב-`exam_sessions`. **הערת סקאלה:** הכיול עוגן לאוכלוסיית האפליקציה (θ = 0 ≈ תלמיד ממוצע כאן); המיפוי θ·20+100 (134 ↔ 1.7) עדיין הנחה עד לקישור לציוני נית"ה רשמיים (equating).
- ציון: `thetaToScore = θ·20 + 100`, חסום 50–150.
- פרק ניסיוני: θ בסיס מפרקים 1–6; אם הכללת פרק 7 מעלה את הציון — לוקחים את הגבוה, מוגבל ל-+2.
- רמות (`classifyScore`): 134+ פטור מלא · 120–133 מתקדמים ב' · 100–119 מתקדמים א' · 85–99 בסיסי · 70–84 טרום-בסיסי ב' · 50–69 טרום-בסיסי א'.
- אימות: 10 מבחנים מבוקרים שוחזרו ב-Python והתאימו לשרת **בדיוק**; 21 סימולאים כיסו את כל 6 הרצועות. ידוע: ניחוש אקראי (25%) → 50, כי c=0.25 הופך ביצוע ברמת מקרה לאפס-אות — התנהגות נכונה של המודל.

### 4.3 כללי נית"ה שנאכפים
| כלל (מקור: nite.org.il) | מימוש |
|---|---|
| טיימר קשיח לכל פרק, זמן לא עובר הלאה | `current_section_expires_at` בשרת; הלקוח מציג countdown ומגיש אוטומטית ב-0 |
| אין חזרה לפרק שנסגר | `current_section_index` מתקדם בלבד; אין UI לחזרה |
| חופש מלא בין שאלות **בתוך** פרק, שינוי תשובות | ניווט חופשי + נקודות ניווט + מקלדת 1–4 / Enter / חצים |
| **אי אפשר לסיים פרק לפני שעונים על כל השאלות** (רק הטיימר מעביר) | (2026-09-16) במבחן אמיתי כפתור "סיים פרק" חוסם עם הודעה ותזכורת לנחש; במוד תרגול חופשי |
| שאלה ריקה = שגויה, כדאי לנחש | `null` נספר כשגוי; הודעות בממשק ובאסטרטגיות |
| הגשה אחרי תום הזמן | (2026-09) שרת: אחרי `expires_at + 20s` התשובות **מתאפסות** ל-null (`lateSubmission: true`) והמבחן ממשיך — כמו במבחן האמיתי |

### 4.4 שלמות ואנטי-רמאות
- `/api/exam/state` במבחן אמיתי **מסיר** `correct_answer` ו-`explanation` מהשאלות (ה-`options_analysis` מסמן את הנכונה). במוד תרגול משאיר (הלקוח צובע מיד).
- `/api/exam/results` מסרב (403) למבחן אמיתי שלא הושלם — אחרת מפתח התשובות של הפרקים הבאים דולף.
- הגשה כפולה של אותו פרק (race, double-click, שני טאבים): `UPDATE ... WHERE current_section_index = X AND completed_at IS NULL` → השני מקבל **409** והלקוח טוען מחדש את המצב.
- טיוטת תשובות בלקוח: `exam_draft:<sessionId>:<section>` ב-localStorage — רענון/קריסה לא מאבדים בחירות בתוך פרק. נמחקת בהגשה/יציאה.
- בזמן שליחה: כל הממשק ננעל (`isSubmittingRef`) — נמצא באג "קפיצה" לפני כן.
- 429 מה-rate-limiter מזוהה במפורש ומוצג כהודעה ברורה (היה נבלע כ"פרק לא הושלם").
- יציאה מהמבחן (✕ + אישור): **מוחקת** את הסשן (`DELETE /api/exam/state`). אין resume — החלטה מודעת ("לתעד ולדחות"). ניסוח היציאה רוכך ב-2026-09.

### 4.5 מניעת חזרות (cross-session dedup)
`lib/question-history.ts`: `user_question_history`/`user_passage_history` לפי `user_key`. משתמש לא רואה שאלה/קטע פעמיים עד מיצוי הפול לאותו סוג+רמה; אז ההיסטוריה מתאפסת. חל על מבחן, תרגול ואבחון.

### 4.5.1 ערבוב אפשרויות (תרגול וחזרה)
`lib/option-shuffle.ts`: כל הגשה של `/api/practice/questions`, `/api/review-queue` ו-`/api/today-session` מערבבת את האפשרויות מחדש (כולל `correct_answer` ו-`options_analysis`), ומצרפת `option_order` (תצוגה → קנוני). כל רישום ל-`responses` נעשה באינדקס הקנוני (`toCanonicalOption`). מבחן (אמיתי ותרגול) **לא** מעורבב.

### 4.6 מעקב קצב
הלקוח מודד שניות/שאלה (`timingsRef`), נשלח ב-`timings[]`, מאומת ונשמר ב-`section_results`. דף התוצאות מציג "ניתוח קצב" (ניצול מול תקציב, ממוצע/שאלה, חריגות מ-"stuck caps": SC 90s / RST 150s / RC 180s).

---

## 5. מפת האתר — כל דף בפירוט

ניווט גלובלי: **BottomNav** (מובייל בלבד, `md:hidden`, 5 טאבים: בית/מבחן/תרגול/מילים/סטטיסטיקה; מוסתר ב-`/exam/[id]` ו-`/review/[id]`; באמצע פעילות — לחיצה ראשונה על כל טאב, כולל הנוכחי, מבקשת "לחץ שוב לצאת" תוך 2.5 שניות; לחיצה על הטאב הנוכחי שלא באמצע פעילות = רענון קשיח כדי לאפס מצב בתוך הדף). **BackNav** (כותרת עם חזרה) בדפים פנימיים. **PwaUpdater** גלובלי. `ActivityGuardProvider` (context `inProgress`) עוטף הכל.

### 5.1 `/` — דף הבית (dashboard)
- שורה עליונה: `StreakBadge` (להבה + מספר ימים, מוסתר כשאין streak, הבהוב עדין), `UserMenu`, `ThemeToggle`.
- לוגו 🎓 `134+`, `HeroTagline` — ברירת מחדל "הכנה ממוקדת לאמירנ"ט — בדרך לפטור"; אם יש ציון אחרון → ניסוח מותאם.
- **`ExamDateCard`** (2026-09-23, מתחת ל-hero): אורח → הזמנה להתחבר; רשום בלי תאריך/תאריך שעבר → באנר שפותח עורך inline (`input type=date`, היום–שנתיים, `PUT /api/goals`); תאריך עתידי → גלולת ספירה לאחור ("עוד N ימים למבחן") עם כפתור עריכה ואפשרות להסיר.
- **טבעות למידה** (`DailyRings`, `lib/rings.ts`) — שלוש, כולן מחושבות בשרת מנתונים מאומתים, בלי ספירות מהלקוח:
  - **A — תרגול מאתגר:** תשובות תרגול/אבחון היום עם `responses.p_correct` ∈ [0.5, 0.85] (ה-p מחושב בשרת בזמן הרישום מאומדן היכולת — EAP על 200 התשובות האחרונות, `lib/ability.ts`; θ שהלקוח שולח נשמר כהקשר בלבד). יעד: `user_goals.daily_activity_target` (ברירת מחדל 15).
  - **B — חזרות בזמן:** שורות `srs_review_log` של היום עם `was_due` (נקבע בשרת ממצב הכרטיס) ו-`answered` — רק הסקירה הראשונה של כרטיס שהגיע מועדו; טעות→מיד נכון לעולם לא נספר. היעד = הושלמו + ממתינים כרגע.
  - **C — סימולציה שבועית:** מבחן מלא לא-תרגול שהושלם מאז ראשון 00:00 (שעון ישראל).
- `StreakCelebration` — מודל מסך-מלא **פעם ביום** (מפתח `amiret_streak_celebration_seen_date`, יום לפי Asia/Jerusalem), נסגר אוטומטית/בלחיצה.
- CTA ראשי "מבחן מלא" → `/exam`.
- `DiagnosticBanner` — לפני מבחן ראשון: "12 שאלות אדפטיביות · ~10 דקות · רמה + תוכנית מותאמת"; אחרי: ניסוח "בדיקה מהירה בין מבחנים".
- כרטיסים: תרגול ממוקד, אוצר מילים ("מעל 1,000 מילים"), `ReviewQueueCard` (כמה שאלות ממתינות לחזרה), `StatsCard` (ציון אחרון/מספר מבחנים), לוח מובילים, אסטרטגיות, טיפים.
- **החלטה:** כל הנתונים מגיעים מקריאה **אחת** — `/api/dashboard-summary` (`DashboardSummaryProvider` context). הרכיבים מרנדרים UI ברירת-מחדל בזמן טעינה/כשל, כך שהדף לעולם לא "נתקע".

### 5.2 `/exam` — בחירת מצב
שלושה כרטיסים: **מבחן מלא** (`mode: 'full'`, "6 פרקים + פרק ניסיוני, טיימר קשיח, אלגוריתם אדפטיבי — במתכונת האמירנ"ט"), **מוד תרגול** (`is_practice: true` — אותו מבנה, בלי טיימר, הסברים מיד, אפשר לחזור לשאלות), **תרגול סעיף** → מפנה ל-`/practice`. וגם באנר אבחון. לחיצה → `POST /api/exam/start` → `router.push(/exam/<id>)`.

### 5.3 `/exam/[sessionId]` — המבחן החי
- כותרת: ✕ יציאה (עם אישור), "מבחן אמירנ"ט", "פרק N — סוג", `ExamTimer` (countdown משעון השרת, אזהרה ב-10 שניות אחרונות), `SectionProgress` (7 פרקים, גלילה אוטומטית לנוכחי).
- `QuestionCard`: טקסט/אפשרויות באנגלית `dir=ltr`, קטע RC מעל השאלות, 4 אפשרויות ממוספרות; במוד תרגול — צביעה מיידית + הסבר (`strategy`, `correct_reason`, `options_analysis` "שלבי שלילה"). במבחן אמיתי — נעילה של תשובה אחרי מעבר? לא: ניתן לשנות עד הגשה (כמו נית"ה).
- ניווט: קודם/הבא, כפתורי "שאלה N" (עם aria-label "נענתה/לא נענתה"), מקלדת 1–4, Enter/Space, חצים. `סיים פרק →` מופיע בשאלה האחרונה.
- באנרים: חסימת סיום עם שאלות ריקות (אמיתי), "הפרק הקודם נשלח אחרי שנגמר הזמן — נחשב כלא נענה" (`lateSubmission`), 409 → טעינה מחדש, 429 → "יותר מדי בקשות".
- F5-recovery: `GET /api/exam/state` (אם הטיימר פג בשרת — מגיש ריקים ומתקדם), טיוטה מקומית משחזרת בחירות.
- סיום → `router.push(/results/<id>)`.

### 5.4 `/results/[sessionId]` — תוצאות
- כרטיס ציון: תווית **"אומדן פנימי של האתר"**, מספר גדול, רמה (פטור/מתקדמים...), `X / Y תשובות נכונות`, הערה על הפרק הניסיוני.
- `AuthCTA` — לאורחים בלבד: "התחבר כדי לשמור את הציון" → `/auth/login?next=<כאן>`.
- "הערכת טווח ציון" — פס צבעוני 50–150 עם מחט, טווח ±10 (≈ SE של CAT ב-27 פריטים), טבלת רצועות. ניסוח: "אומדן פנימי של האתר, לא ציון רשמי של נית"ה" (2026-09-16).
- פירוט לפי פרק + המסלול האדפטיבי (רמה 1–5 שאליה נותב כל פרק), ניתוח קצב, כפתורים: סקירת שאלות (`/review/<id>`), מבחן חדש, סטטיסטיקות.
- נתונים: `GET /api/exam/results` (בעלות נבדקת; 403 אם מבחן אמיתי לא הושלם → מפנה חזרה למבחן).

- **(2026-09-23) כרטיס "מה הסיכוי שלך ל-134+?"** (`components/results/ExemptionCard.tsx`) החליף את פס ±10 הקבוע: מד חצי-עיגול של `p_exempt`, ניסוח בתדירות ("בערך 7 מתוך 10"), מסלול 50–150 עם טווח 80% אמיתי (θ̂ ± 1.28·SE) וקו 134. מבחנים ישנים (לפני שמירת `p_exempt`) מחושבים מחדש בדפדפן באותן פונקציות בדיוק (`lib/exemption.ts`).
- **בסטטיסטיקות:** "הסיכוי שלך ל-134+ כרגע" — 3 המבחנים האחרונים משוקללים לפי דיוק, **בלי** מבחנים שנמוכים בבירור מהאחרון (פער > 1.645·√(SE₁²+SE₂²), חד-צדדי: פריצת דרך מוצגת מיד; יום חלש אחרון עדיין מוחלק). עלייה הדרגתית בתוך רעש המדידה (למשל 127→131→138) נשארת משוקללת.

### 5.5 `/review/[sessionId]` — סקירת מבחן
כל השאלות עם התשובה שנבחרה מול הנכונה, הסבר מלא, פילטר הכל/טעויות/נכונות, סרגל צד (desktop) ונקודות (mobile) צבועים ירוק/אדום. `GET /api/exam/review` (401 בלי בעלות).

### 5.6 `/practice` — תרגול ממוקד
זרימה: **סוג** (השלמת משפטים / ניסוח מחדש / הבנת הנקרא / "חזרה על טעויות" → `/review-queue` / קישור לאוצר מילים) → **רמה** (1–5 עם טווחי ציון, או 🎲 מעורב) → **כמות** (5/10; RC תמיד 5) + **מצב**:
- **למידה** — הסבר מיד, אפשר לחזור לשאלה קודמת (קריאה בלבד).
- **אימון מהירות** — טיימר לכל שאלה (SC 45s / RST 50s / RC 90s), בחירה אחת.
- **מקבץ בתנאי אמת** — פורמט פרק אמיתי (SC 4q/240s, RST 3q/360s, RC 5q/900s), countdown אחד, ניווט חופשי, הגשה אוטומטית, סקירה בסוף, בלי רמזים.
- Deep link: `/practice?type=X&difficulty=Y` (מהסטטיסטיקות "תרגל את החולשה שלך" ומהאבחון).
- מסך סיום: אבחון רמה IRT/EAP (רמה 1–5 + ציון משוער + רצועה; "רמה מעורבת" במצב אקראי).
- כל תשובה → `POST /api/responses` (רישום + FSRS + סימון יום ל-streak, הכל בשרת). מסמן `inProgress` ל-BottomNav.
- נתונים: `GET /api/practice/questions` (stateless, dedup בין סשנים).

### 5.7 `/diagnostic` — אבחון מהיר
12 שאלות, 4 שלבים × 3 (SC/RST/SC/RST — 6/6, בלי RC כי קטע = 5 שאלות שהיו מכפילים את האורך). שלב 1 ברמה 3, כל שלב הבא מנותב לפי θ מצטבר (אותו 3PL, בצד הלקוח). בלי פידבק מיידי ("ענה לפי תחושת הבטן"). תוצאה: רמה 1–5, ציון משוער, פירוט לפי סוג (עם אזהרת מדגם קטן <5), תוכנית התחלה עם deep-links. שולף `count=10` לכל שלב ונכשל למסך שגיאה אם אחרי dedup אין 3 (היה באג של 11/12).

### 5.8 `/review-queue` — חזרה על טעויות (spaced repetition)
- **(2026-09-23) מנוע FSRS מבוסס-מושגים** (`lib/fsrs.ts` מתמטיקה טהורה, `lib/srs.ts` שמירה ושליפה) החליף את הכפלת המרווחים. יחידת התזמון היא **מושג** (`questions.concept_key`), לא שאלה: כרטיס אחד לכל בעלים×מושג ב-`srs_cards`.
- **תיוג מושגים:** `questions.skill` + `target_lemma` מסווגים ב-SQL (`classify_question`, טריגר על insert/עריכה): SC → המילה הנכונה (`sc.vocab`/`sc.connector`); ניסוח מחדש → מילת הקישור (`rst.contrast/though`…), בלי מילת קישור → `rst.general` שמתוזמן לפי פריט; RC → המיומנות (`rc.main_idea`, `rc.inference`, `rc.detail`…), ו-`rc.vocab_in_context/<המילה>`. `concept_key` עמודה מחושבת. כיסוי אחים: RC 85%, SC 53%, RST 47%.
- **מקור:** כל תשובה שנרשמת (`/api/responses` מתרגול/חזרה/אבחון/היום; מבחן — בסיום, מתוך שורות `responses` של הסשן). טעות על מושג בלי כרטיס → כרטיס חדש (עוגן = השאלה שנכשלה). תשובה נכונה על מושג בלי כרטיס → לא נרשם כלום.
- **מודל:** FSRS-4.5 (משקלות ברירת מחדל). יציבות/קושי/retrievability לפי **זמן שעבר בפועל** — תשובה נכונה דקה אחרי טעות כמעט לא מזיזה. ציון סמוי: שגוי=Again; נכון מהר מדי (<5% מהתקציב, ניחוש)=Hard; ≤⅓ תקציב=Easy; ≤תקציב=Good; מעל=Hard (תקציב: SC 60s, RST 120s, RC 180s); ביטחון עצמי יכול רק להוריד. טעות ראשונה → זמינה בעוד ~12 שעות (לא מיד). מרווחים 6 שעות–180 יום. אין "graduation".
- **מועד מבחן** (`user_goals.exam_date`, `PUT /api/goals`, משתמשים רשומים בלבד): יעד השליפה עולה מ-90% ל-95% ב-14 הימים האחרונים; מועד שחורג נמשך לחלון 1–3 ימים לפני המבחן (יעד: 2); 24 השעות האחרונות ללא חזרות מתוזמנות. קביעת מועד מיישרת מיד כרטיסים קיימים.
- **שליפה:** לכל כרטיס שהגיע מועדו מוגשת **שאלת אח** אקראית מאותו מושג (`srs_pick_siblings`, לא העוגן ולא שאלה שנענתה ב-14 הימים האחרונים); אין אח → העוגן. `review_queue` + ה-RPCs הישנים נשארו רק לתאימות חלון הפריסה (לא נכתבים); `srs_import_legacy_review_queue()` מייבא מחדש.
- ממשק: סקירה לפי קטגוריה (סוג שאלה) עם ספירות, התחלת סשן (הכל / קטגוריה), מחיקת שאלה בודדת / קטגוריה / הכל, "התחל מחדש", בוחר שאלות באמצע. מחיקת שאלה אחרת מהנצפית לא מזיזה את המצביע (תוקן — מעקב לפי id).
- נתונים: `GET /api/review-queue` (כרטיסים שהגיע מועדם → שאלה לכל כרטיס עם `review: {conceptKey, sibling}`, אפשרויות מעורבבות), `DELETE` (הכל / `questionId` → הכרטיס של המושג שלה / `type`). אין POST — תשובות עוברות דרך `/api/responses`.

### 5.9 `/vocabulary` — אוצר מילים (1,417 שורות — הדף הגדול ביותר)
- 1,158 מילים, 7 קטגוריות: verbs 287, connectors 182, academic 178, adjectives 166, nouns 136, advanced 122, descriptive 87; רמות 1–5. נטענות פעם אחת ונשמרות ב-`vocab_cache_v3` (6 שעות) — **תיקוני תרגום ב-DB מופיעים אצל משתמש קיים רק אחרי פקיעת המטמון**.
- מצבים: **כרטיסיות** (הפיכה, "ידעתי/לא ידעתי" עם אנימציית swipe, ❤️ מועדפים, 🔊 הגייה, סינון קטגוריה/רמה), **רשימה**, **חידון** (4 אפשרויות, מסיחים לפי 4 שכבות דמיון: אותה קטגוריה+רמה±1 → קטגוריה → רמה → כל השאר; דורש ≥4 מילים), **חידון בזמן** (5/10/20 מילים × 10/15/20/30 שניות, היסטוריית 10 ריצות אחרונות ב-`vocab_timed_history`).
- **חבילות** (packs): `?pack=connectors` (208 מילות קישור — "מכפיל כוח"), `favorites`, ו-**"המילים שהפילו אותי"** (`/api/my-words` — מילים מהשלמות משפטים שנענו לא נכון בתור החזרה; סיום השאלה בתור = המילה "נלמדה").
- מצב "ידעתי": אורח → `vocab_known_ids`/`vocab_favorites` ב-localStorage; רשום → `user_vocab_known`/`user_vocab_favorites` ב-DB (RLS own-rows).
- באגים שתוקנו: guard על אנימציה כפולה, ספירת "נכון" חיה בחידון בזמן, מינימום 4 מילים לחידון, deck לא מתערבב בלחיצת ❤️ (תלות `favorites` רק כשהחבילה היא מועדפים), a11y (`aria-label`/`aria-pressed`).
- **תוכן:** 6 סבבי ביקורת תרגום (2026-09) עם סוכנים מקבילים מול Morfix/Reverso → ~90 תיקונים. סבב 6 הושלם רק ב-1 מ-6 קבוצות.

### 5.10 `/stats` — סטטיסטיקות
- עובד לאורח ולרשום (מחושב מ-`exam_sessions` שהושלמו, `GET /api/stats`).
- דוח **מוכנות** (מוכן / כמעט / עוד לא): ≥3 מבחנים, ממוצע 3 אחרונים ≥134, פיזור ≤12, דיוק לפי סוג ≥70%, "הישרדות" ברמות 4–5 ≥55%, קצב ≤15% מעל תקציב.
- **"הדרך ל-134+"**: פס התקדמות לפי ציון-שיא, פער בנקודות, תחזית ליניארית על 10 האחרונים ("עוד ~N מבחנים"), גרף היסטוריה (recharts) עם קו 134.
- דיוק לפי סוג שאלה ולפי רמת קושי (נגזר מ-`questions[0].difficulty_level` בכל פרק), "תרגל את החולשה שלך" → deep-link ל-`/practice`.

### 5.11 `/leaderboard` — לוח מובילים
Server component; `SELECT display_name, avatar_url, best_score, total_exams, avg_score FROM leaderboard ORDER BY best_score DESC LIMIT 50`. רק משתמשים רשומים (הטריגר מזין רק `auth.users`). **אין pagination** (נדחה). `user_id` **אינו קריא** ל-anon/authenticated (GRANT ברמת עמודה, 2026-09).

### 5.12 `/strategies` — מדריך אסטרטגיה (server component, data-driven)
9 נושאים באקורדיון: חוקי המשחק (אדפטיביות, אין חזרה, טיימר קשיח, אין קנס), תקציב זמן + stuck caps, השלמת משפטים (שיטה + דוגמה), ניסוח מחדש, הבנת הנקרא, מילות קישור (ניגוד/סיבה-תוצאה/תוספת/תנאי), איפה להשקיע (פרק 1 קובע מסלול, RC = בור זמן בטוח, ניסיוני = בונוס), שיטות קריאה (שאלות-קודם / קריאה מלאה / משולב — מומלץ), הרגלי הכנה (עם CTA לאתר). ניסוחים שרוככו 2026-09-16: "לא **רק** מבחן אוצר מילים". הבעלים בחר **להשאיר**: "אך ורק דרך פרקים קשים", "בדיוק כשאתה עומד לשכוח", "10 דקות = 50 שאלות".

### 5.13 `/tips` + `/tips/sentence-completion` · `/tips/restatement` · `/tips/reading-comprehension`
מדריכים סטטיים לפי סוג שאלה (שיטת 5 שלבים ל-SC כולל "ענה בראש לפני האפשרויות", "ליבת המשפט" ל-RST, ניהול זמן ל-RC ~4–5 דק' קריאה + ~2 דק'/שאלה).

### 5.14 `/admin` — פאנל אדמין
מוגן ב-`useAdminGate` (`GET /api/admin/check` → `ADMIN_EMAILS`); לא-מורשה מופנה החוצה בלי הבזק. יצירת שאלות ב-GPT-4o לפי סוג/רמה/כמות + "הזרעה המונית". **הגנה אמיתית** רק ב-`/api/questions/generate` (השרת בודק את המייל שוב). סוג `esra` קיים ב-types/admin (שריד היסטורי, לא בשימוש במבחן).

### 5.15 SEO/PWA
`robots.ts`, `sitemap.ts`, metadata OG/Twitter ב-layout (בלי תמונת OG — ניסיון `next/og` דינמי שבר את הפריסה ב-Vercel בלי שגיאה נגישה; אם חוזרים לזה — תמונה סטטית). כל הדפים יורשים title/description גלובליים (per-page metadata נדחה).

---

## 6. רכיבים משותפים ומצב לקוח

### 6.1 Theme
`ThemeToggle` כותב `theme` ב-localStorage; סקריפט inline ב-`<head>` מוסיף `class="dark"` לפני הציור (בלי הבזק); ברירת מחדל = `prefers-color-scheme`. Tailwind `@custom-variant dark (&:is(.dark *))`.

### 6.2 מפתחות localStorage (מלא)
| מפתח | תוכן |
|---|---|
| `amiret_guest_id` | UUID אורח |
| `sb-<ref>-auth-token` | סשן Supabase |
| `theme` | `dark`/`light` |
| `exam_draft:<sessionId>:<section>` | מערך תשובות טיוטה |
| `amiret_streak_celebration_seen_date` | YYYY-MM-DD |
| `vocab_cache_v3` | כל המילים + timestamp (6h) |
| `vocab_known_ids`, `vocab_favorites` | Set של ids (אורח) |
| `vocab_timed_history` | 10 ריצות אחרונות |
| `sessionStorage`: דגל PwaUpdater | "הוצג באנר עדכון בטאב הזה" |

---

## 7. API — כל ה-routes (`src/app/api`)

כולם עוברים דרך ה-middleware (rate-limit). `[auth]` = מזהה בעלות דרך bearer או `guestId`.

| Route | Method | תפקיד | הערות |
|---|---|---|---|
| `/api/exam/start` | POST | פותח סשן; פרק 1 ברמה 3; dedup; טיימר שרת | `{ mode, guestId, isPractice }` |
| `/api/exam/answer` | POST | מגיש פרק: עדכון θ, ניתוב, שליפת הפרק הבא, timings, סיום (ציון, ניסיוני, review-queue, activity_log) | late-submission (20s grace), update אטומי → 409, מחזיר `lateSubmission` |
| `/api/exam/state` | GET | מצב לשחזור F5; אוכף טיימר; מסיר מפתח תשובות במבחן אמיתי | |
| `/api/exam/state` | DELETE | מחיקת סשן ביציאה | |
| `/api/exam/results` | GET | תוצאות עם בדיקת בעלות | 403 אם אמיתי ולא הושלם |
| `/api/exam/review` | GET | שאלות+תשובות+הסברים לסקירה | 401 בלי בעלות |
| `/api/practice/questions` | GET | שאלות לתרגול/אבחון (stateless) | `type, difficulty|random, count, guestId` |
| `/api/review-queue` | GET/DELETE | תור חזרה מרווחת (FSRS, שאלות אח) | ראה §5.8; GET מערבב אפשרויות |
| `/api/goals` | GET/PUT | מועד מבחן (`examDate`) + יעד יומי | רשומים בלבד ל-PUT; תאריך היום–שנתיים; מיישר כרטיסים |
| `/api/responses` | POST | רישום תשובות מתרגול/חזרה/אבחון ל-`responses` | עד 25 בבקשה; `chosenOption` קנוני; הנכונות נבדקת בשרת. מבחן נרשם אטומית ב-`commit_exam_section` |
| `/api/my-words` | GET | מילים מטעויות SC | gloss עברי מתוך `correct_reason` |
| `/api/stats` | GET | כל הסשנים שהושלמו של הבעלים | |
| `/api/dashboard-summary` | GET | streak, ציון אחרון, מספר מבחנים, ספירת תור | `head:true` counts — קריאה אחת זולה |
| `/api/streak` | GET | streak בלבד | `lib/streak-server.ts`: ימים רצופים (Asia/Jerusalem) עם פעילות ב-`activity_log`, מסתיימים היום או אתמול |
| ~~`/api/activity/complete`~~ | — | **הוסר (2026-09-23)** — קיבל ספירות יחידות מהלקוח בלי אימות. יום פעיל ל-streak מסומן עכשיו בשרת מתוך `/api/responses` ומבחנים | |
| `/api/auth/merge-guest` | POST | מיזוג אורח→חשבון | 403 אם guestId = משתמש רשום |
| `/api/profile/update-name` | POST | שם תצוגה | |
| `/api/profile/upload-avatar` | POST/DELETE | אווטאר | bucket `avatars` |
| `/api/admin/check` | GET | האם המשתמש אדמין | UX gate |
| `/api/questions/generate` | POST | יצירת שאלות GPT-4o (אדמין) | |
| `/api/cron/keep-alive` | GET | ping יומי ל-DB | `Bearer CRON_SECRET`, אחרת 401 |

---

## 8. מסד הנתונים (Supabase Postgres 17) — מצב חי

### 8.1 טבלאות (`public`)
| טבלה | עמודות עיקריות | RLS | מדיניות |
|---|---|---|---|
| `questions` | `id, type, text, passage_id, options jsonb [{id,text}×4], correct_answer 0–3, explanation (JSON string: strategy/correct_reason/options_analysis[4]), a, b, c, difficulty_level 1–5, created_by, hint, active, skill, target_lemma, concept_key (מחושב)` | ✅ | **אין** → service-role בלבד. `/api/exam/state` מסיר את שלוש עמודות המושג במבחן אמיתי (ב-SC ה-lemma = התשובה) |
| `passages` | `id, text, difficulty_level, b, active` | ✅ | אין |
| `exam_sessions` | `id, user_id (guest או auth), mode, started_at, completed_at, current_section_index, current_section_expires_at, theta, theta_history, theta_final, score, questions_by_section jsonb (snapshot!), section_results jsonb, answers_by_section jsonb, is_practice, used_question_ids[], used_passage_ids[]` | ✅ | אין |
| `review_queue` | `id, guest_id text, user_id uuid, question_id, times_wrong, interval_days, next_review_at, last_reviewed_at` | ✅ | אין. **מיושן (2026-09-23)** — לא נכתב ע"י הקוד; להסיר אחרי חלון הפריסה |
| `srs_cards` | `owner_id, owner_type, concept_key (unique per owner), item_type, skill, target_lemma, anchor_question_id, stability, difficulty, reps, lapses, last_review_at, due_at, version (CAS)` | ✅ | אין (service-role בלבד); merge-guest מעביר (כרטיס קיים של החשבון גובר) |
| `user_question_history` / `user_passage_history` | `user_key text, question_id/passage_id, seen_at` (unique) | ✅ | אין |
| `srs_review_log` | `owner_id, owner_type, card_id → srs_cards (set null), concept_key, item_id, grade 1–4, answered, was_due, elapsed_days, stability/difficulty before/after, reviewed_at` | ✅ | אין (service-role בלבד). מקור טבעת B + נתוני אימון ל-FSRS |
| (`questions` +) | `b_calibrated` (±4), `calibration_n`, `calibrated_at` | | `b` ו-`difficulty_level` לא משתנים |
| (`responses` +) | `calibrated` (תשובה כבר כיילה את הפריט) | | |
| (`exam_sessions` +) | `theta_se`, `p_exempt` | | |
| `activity_log` | `user_id text, activity_date, source` (העמודות `activity_units`/`review_cleared` כבר לא נקראות — streak בלבד) | ✅ | public ALL ("app enforces ownership") |
| `user_stats` | `user_id, total_exams, best_score, avg_score, last_exam_at, score_history jsonb, performance_by_type, display_name, avatar_url` | ✅ | own read/write (`auth.uid()`) |
| `leaderboard` | `user_id, display_name, avatar_url, best_score, total_exams, avg_score, last_exam_at` | ✅ | public SELECT **+ GRANT ברמת עמודה** ל-anon/authenticated על כל העמודות **חוץ מ-`user_id`** |
| `responses` | `owner_id, owner_type (user/guest), item_id → questions, context (exam/practice/review/diagnostic), correct, chosen_option (אינדקס קנוני; null = ריק), latency_ms (זמן על הפריט עד תשובה סופית), confidence 1–3, theta_before, section_index, session_id → exam_sessions (set null), created_at` | ✅ | אין (service-role בלבד); merge-guest מעביר שורות אורח |
| `vocabulary` | `id, word (unique), definition, hebrew_translation, example_sentence, category, difficulty_level` | ✅ | public read |
| `user_vocab_known`, `user_vocab_favorites` | `user_id, word_id` | ✅ | own rows |

### 8.2 טריגר ופונקציה
`trg_update_stats` (AFTER UPDATE על `exam_sessions`) → `update_user_stats_on_complete()` (SECURITY DEFINER, `search_path` נעול): כשמבחן הושלם לראשונה עם ציון **ומשתמש קיים ב-`auth.users`** — upsert ל-`user_stats` (ממוצע מצטבר, שיא, היסטוריה) ואז upsert ל-`leaderboard`. **אורחים לא נכנסים** לסטטיסטיקות/לוח — לכן `merge-guest` מחשב אותם מחדש בעצמו.

### 8.3 אינדקסים, הרחבות, Storage
אינדקסים על `questions(type,difficulty)`, `questions(passage)`, `questions(active)`, היסטוריות לפי `user_key`, `review_queue` לפי guest/due ו-user, `exam_sessions(user)`. הרחבות: `pg_trgm` (שימש לאיתור קטעים כפולים דומים), `uuid-ossp`, `pgcrypto`. Storage bucket `avatars` (public).

### 8.4 נפחי תוכן (2026-09-16)
- שאלות פעילות: **7,428** (114 לא פעילות = כפילויות/פגומות שהוצאו). לפי סוג/רמה: RC 500 בכל רמה (500 קטעים × 5); RST 443/563/494/488/498; SC 367/610/501/473/491.
- קטעים פעילים: 500. אוצר מילים: 1,158. סשנים: 196 (142 הושלמו, 19 תרגול). משתמשים רשומים: 6. תור חזרה: 153 שורות.
- קונבנציית שאלה: 4 אפשרויות `{id: a–d, text}`, `explanation` = מחרוזת JSON `{strategy, correct_reason, options_analysis[4] מיושר לסדר האפשרויות עם סימון "נכון!"}`, `c=0.25`, `a∈0.9–1.8` בד"כ, `b` ממורכז לפי רמה (L1≈-2 … L5≈+2). **חובה לגוון את מיקום התשובה הנכונה** (נמצאה הטיה ל-index 0 ותוקנה).
- ביקורות שנעשו על הבנק: הטיית מיקום, יישור `options_analysis` (511 שאלות תוקנו/רוקנו), כפילויות (מדויקות + fuzzy), דליפת תשובה בגזע, 8 בדיקות מכניות — כולן נקיות.

---

## 9. אבטחה — מודל ומצב

**עיקרון:** ה-DB נעול (RLS בלי מדיניות על כל טבלאות התוכן והסשנים); **כל** גישה עוברת דרך API routes עם service-role, וה-route אחראי לבדוק בעלות (`user.id` או `guestId`). הלקוח לעולם לא שואל את הטבלאות הרגישות ישירות.

| וקטור | מצב |
|---|---|
| קריאת שאלה/תשובה נכונה ישירות מ-Supabase | חסום (RLS ללא policy, אומת: anon REST → `[]`/401) |
| קריאת סשן של אחר לפי UUID | חסום — results/review/stats/state בודקים בעלות |
| מפתח תשובות במבחן פעיל | מוסר ב-state; results 403 עד השלמה |
| גניבת היסטוריה דרך merge-guest | חסום — guestId שהוא auth user → 403 |
| `user_id` בלוח המובילים (זרע לשרשרת התקיפה הנ"ל) | חסום — GRANT ברמת עמודה; REST `select=user_id` → 401 |
| הגשה כפולה / אחרי הזמן | 409 / איפוס תשובות |
| Rate limiting | 120/דקה/IP, Upstash (משותף) |
| אדמין | `ADMIN_EMAILS` בשרת |
| Supabase advisors | נותרו: 5×INFO "RLS enabled no policy" (מכוון), WARN "Leaked Password Protection" (הגדרת דשבורד, לא הופעלה) |
| מיילי Auth | תבנית גנרית, מגבלת קצב נמוכה (Free) |
| מפתח anon ב-`keepalive.yml` | ציבורי ממילא (חשוף בלקוח) |

---

## 10. תוכן ומתודולוגיית ביקורת אוצר המילים (לידיעת מי שממשיך)

סבב = 6 סוכנים מקבילים, כל אחד על 193 מילים (`ORDER BY word, id LIMIT 193 OFFSET k·193`), בודקים תרגום עברי↔אנגלי מול Morfix/Reverso + הגדרה + דוגמה; המחלוקות מאומתות שוב ידנית; תיקון ב-`UPDATE vocabulary SET hebrew_translation=... WHERE id=...`. הסבבים מצאו 26/11/18/12/19 תיקונים (+4 מדוח Codex: apparent, dissent, parsimonious, vitriolic). ידוע שתשואה יורדת אבל לא אפס. סוכנים נופלים על HTTP 429 (מגבלת סשן) — להריץ מחדש קבוצות שנכשלו.

---

## 11. CI/CD ותפעול

- push ל-`main` → GitHub Actions (test+build) **וגם** Vercel build+deploy במקביל. סטטוס פריסה: `gh api repos/maorfurman4/app-amiret-prep/commits/<sha>/status`.
- לפני commit: `git checkout -- public/sw.js` (הבנייה משכתבת אותו).
- לוגים של Vercel: רק בדשבורד (Deployments → build/runtime logs). ה-MCP 403.
- Supabase: SQL דרך ה-MCP connector (`execute_sql`) או הדשבורד; admin API (משתמשים) דורש service-role — עכשיו זמין מקומית.
- Keepalive כפול: Vercel cron יומי (דורש `CRON_SECRET`) + GitHub Actions פעמיים בשבוע.
- Preview deploys: env vars חייבים סקופ Preview.

---

## 12. החלטות מוצר מתועדות (ולמה)

| החלטה | סיבה |
|---|---|
| Guest-first, חשבון אופציונלי | הורדת חיכוך; ההיסטוריה ממוזגת בהתחברות כך שלא מפסידים כלום |
| אין AI בזמן מבחן/תרגול | היקף = הכנה לאמירנ"ט; הסברים כתובים מראש בבנק; AI רק לייצור תוכן ע"י אדמין |
| הפרק הניסיוני = השלמת משפטים ולא הפורמט האמיתי | הבעלים: "נשאיר כמו שזה" |
| יציאה מוחקת את המבחן, אין resume | "לתעד ולדחות" — פשטות; ההודעה למשתמש אומרת זאת במפורש |
| חסימת סיום פרק עם ריקים במבחן אמיתי, לא בתרגול | כלל נית"ה; תרגול נשאר גמיש |
| ציון מוצג כ"אומדן פנימי" | לא לרמוז שזה ניבוי רשמי |
| streak פעם ביום במרכז המסך, הבאדג' רק מהבהב | "לא רוצה שיקפוץ כל פעם" |
| `/api/dashboard-summary` נפרד מ-`/api/stats` | דף הבית צריך 4 מספרים, לא את כל ה-JSONB |
| Serverless ב-bom1, Edge/Redis ב-fra1 | Serverless צמוד ל-DB; Middleware רץ ב-PoP הקרוב למשתמש (ישראל) |
| `leaderboard` טבלה ייעודית במקום view על `auth.users` | דליפת מיילים בעבר |
| ±10 בטווח הציון | SE אמפירי של CAT ב-~27 פריטים |
| dedup בין סשנים עד מיצוי הפול | "לא לראות אותה שאלה פעמיים" |
| review-queue: טעות חדשה זמינה מיד | Anki-style; המרווח מתחיל רק אחרי הצלחה |

---

## 13. היסטוריה תמציתית (ציוני דרך)

- **2026-06-19** יצירת הפרויקט. **07-04** מודל אמירנ"ט מלא + IRT; מיתוג 134+; אבטחה שלב A/B (leaderboard table, RLS). **07-05** `getServerClients` + bearer (לפני כן כל המשתמשים רצו כאורחים!), merge-guest, PWA updater, dark mode, בנק +135 שאלות, אסטרטגיות. **07-06** קצב/timings, practice modes, CI+vitest, אבחון, מוכנות, streak, +8 קטעים. **07-07** נעילת `exam_sessions`, `/api/exam/results` + `/api/stats`, גיבוי תוכן. **08-03** Supabase auto-pause → restore. **08-05** הזרעה המונית (~37 קבצי SQL) → ~7.4K שאלות, 500 קטעים. **08-11/12** ביקורת בנק (66+14 יישורים, כפילויות fuzzy), stress-test 4 סוכנים, a11y, SEO, Upstash, keepalive cron. **09-16** דוח Codex: אבטחה (merge-guest, results 403, leaderboard grants), שלמות מבחן (late submit, 409, drafts), פונט, BottomNav, איפוס סיסמה, כלל נית"ה, ריכוך ניסוחים, dashboard-summary, streak celebration, מחיקת קוד AI מת, 90 תיקוני אוצר מילים.

---

## 14. בעיות ידועות, מגבלות, חוב טכני וסיכונים

### 14.1 פתוח / מודע
1. **Supabase Free tier** — auto-pause אחרי ~שבוע ללא פעילות (מטופל ב-2 keepalives, אבל תלוי בהם); אין PITR; מגבלת מיילי Auth; 500MB DB (51MB בשימוש).
2. **גיבוי תוכן ישן** (2026-07-07, ~1K שאלות) מול 7.4K היום — להריץ `scripts/backup-content.ts` (עכשיו אפשרי מקומית).
3. **אין SMTP מותאם** → מיילי אישור/איפוס גנריים ומוגבלים; תבנית ממותגת עוצבה אך לא הותקנה.
4. **Leaked Password Protection** לא מופעל (דשבורד Supabase).
5. **פרק ניסיוני** לא תואם את הפורמט האמיתי (החלטה).
6. **אין resume למבחן** אחרי יציאה מכוונת (החלטה). F5/קריסה — כן משוחזר.
7. **לוח מובילים** ללא pagination, רק 50 ראשונים, רק רשומים.
8. **מטמון אוצר מילים 6 שעות** — תיקוני DB לא מיידיים למשתמשים קיימים.
9. **README** גנרי; `supabase-schema.sql` לא מסונכרן עם ה-DB החי.
10. **סוג `esra`** שריד ב-types/admin/labels — לא בשימוש במבחן; ניתן להסיר.
11. **per-page metadata / OG image** — לא מומש.
12. **חוב eslint** (לא משפיע על המשתמש, `npm run lint` אדום): `exam/[sessionId]/page.tsx` — `Date.now()` ב-`useRef` initializer, `setState` בתוך effects, "accessed before declared" (`submitSection`/`handleAnswer` ב-closures), 2×`"` לא-escaped; `auth/login/page.tsx` — `<a href="/">` במקום `<Link>`, dep warning; `BottomNav.tsx` — `set-state-in-effect`. `tsc` נקי (למעט `.next/dev/types` ישנים למסלולי AI שנמחקו — cache מקומי).
13. **קלוברציית IRT** מבוססת על פרמטרים שנכתבו ידנית/הוזרעו, לא על נתוני נבחנים אמיתיים — recalibration נדחה עד ~50 מבחנים אמיתיים.
14. **rate-limit fallback in-memory** לא אמין (לפי-instance) — רלוונטי רק אם Upstash לא מוגדר.
15. **סבב 6 של ביקורת אוצר המילים** לא הושלם (5/6 קבוצות).
16. **`activity_log`** עם policy `public ALL` — הבעלות נאכפת באפליקציה בלבד (הקריאות עוברות דרך service-role ממילא; לשקול לנעול).

### 14.2 סיכונים תפעוליים
- תלות בחשבון Supabase של צד שלישי (edenel-s) — לוודא גישה/בעלות.
- כל שינוי env ב-Vercel דורש Redeploy.
- `public/sw.js` משתנה בכל build — לא לקמט בטעות.
- **כלי עריכה:** בסביבת Claude Code, Write/Edit נחסמים על נתיב הפרויקט (worktree guard) — עריכות נעשות ב-`bash heredoc`/`python3` עם `assert count==1`.

### 14.3 מה **לא** באג (אומת, לא לתקן)
- ניחוש אקראי → ציון 50 (c=0.25).
- הכל-נכון → 150 / הכל-שגוי → 50 (MLE נכשל → EAP).
- 429 בבדיקות עומס סקריפטיות — ה-limiter עובד כמתוכנן.
- גזעי RC "What is the passage mainly about?" חוזרים בין קטעים — לא כפילות.
- persistent→"עיקש", abate→"לשכך/להירגע", absorption→"בליעה" — תרגומים נכונים שסומנו בטעות ע"י סוכן.

---

## 15. מילון מונחים
**θ (theta)** – יכולת סמויה במודל IRT. **3PL** – מודל 3 פרמטרים (a הבחנה, b קושי, c ניחוש). **CAT/MSCAT** – מבחן אדפטיבי ממוחשב רב-שלבי. **EAP/MLE** – שיטות אומדן θ. **SC/RST/RC** – השלמת משפטים / ניסוח מחדש / הבנת הנקרא. **פטור** – ציון ≥134. **נית"ה** – המרכז הארצי לבחינות ולהערכה. **Guest** – משתמש ללא חשבון עם UUID מקומי. **Service role** – מפתח Supabase שעוקף RLS (שרת בלבד).
