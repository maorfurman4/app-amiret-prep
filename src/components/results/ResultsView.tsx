'use client';

import { useId, useState, type ReactNode } from 'react';
import Link from 'next/link';
import { AlertTriangle, BookOpen, CheckCircle2, ChevronDown, ChevronLeft, Clock } from 'lucide-react';
import { BackNav } from '@/components/BackNav';
import { Reveal } from '@/components/strategies/Reveal';
import { CARD_LINK, ICON_TILE } from '@/components/home/surfaces';
import { tone } from '@/components/stats/TypePerformanceCard';
import { isExperimentalSection, SECTION_CONFIGS, type Question, type SectionResult } from '@/types/exam';
import { thetaToScore } from '@/lib/adaptive';
import { scoreInterval, sessionMeasurement } from '@/lib/exemption';
import { sectionLevelTag, type ThetaHistoryEntry } from '@/lib/routed-level';
import { aggregateAccuracyByType, isSkippedSection, scoredTotals } from '@/lib/weakness';
import { heCount, agree } from '@/lib/hebrew-count';
import { showPaceAnalysis } from '@/lib/practice-exam';
import { ResultsHero, PlusMark } from './ResultsHero';

export interface ResultsSession {
  score: number;
  theta_final: number;
  theta_se?: number | null;
  p_exempt?: number | null;
  theta_history: ThetaHistoryEntry[];
  section_results: SectionResult[];
  answers_by_section: Record<number, (number | null)[]>;
  questions_by_section: Record<number, Question[]>;
  is_practice: boolean;
  completed_at?: string | null;
}

const TYPE_LABELS: Record<string, string> = {
  sentence_completion: 'השלמת משפטים',
  restatement: 'ניסוח מחדש',
  reading_comprehension: 'הבנת הנקרא',
  esra: 'אנגלית ESRA',
};

const SCALE = [
  { range: '134–150', label: 'פטור מלא', min: 134, max: 150 },
  { range: '120–133', label: 'מתקדמים ב\'', min: 120, max: 133 },
  { range: '100–119', label: 'מתקדמים א\'', min: 100, max: 119 },
  { range: '85–99', label: 'בסיסי', min: 85, max: 99 },
  { range: '70–84', label: 'טרום-בסיסי ב\'', min: 70, max: 84 },
  { range: '50–69', label: 'טרום-בסיסי א\'', min: 50, max: 69 },
];

const HEADING = 'text-lg font-extrabold tracking-[-0.015em] text-exam-ink';

/** A heading-sized toggle over a region that opens in place. */
function Disclosure({ label, children }: { label: string; children: ReactNode }) {
  const id = useId();
  const [open, setOpen] = useState(false);
  return (
    <div className="border-t border-exam-border pt-1">
      <button
        type="button"
        aria-expanded={open}
        aria-controls={id}
        onClick={() => setOpen(o => !o)}
        className="flex w-full min-h-11 items-center gap-2 rounded-lg text-start text-sm font-semibold text-exam-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-exam-accent"
      >
        {label}
        <ChevronDown className={`ms-auto size-4 shrink-0 text-exam-ink-soft transition-transform duration-300 motion-reduce:transition-none ${open ? 'rotate-180' : ''}`} aria-hidden />
      </button>
      <Reveal open={open} id={id}>{children}</Reveal>
    </div>
  );
}

/**
 * The loaded results screen, split from the page (which fetches) so it can
 * be previewed and tested from a session alone. Three depths, as on /stats:
 * the score panel raised, the scale and pace flat on the page, the
 * breakdown by type recessed. `between` holds what the page shows under the
 * score (streak, official-score prompt, sign-in) — they fetch on their own.
 */
export function ResultsView({ session, sessionId, between }: { session: ResultsSession; sessionId: string; between?: ReactNode }) {
  const score = session.score ?? thetaToScore(session.theta_final ?? 0);
  const exemption = sessionMeasurement(session);
  // The likely range of the score (80% interval of this exam's measurement).
  const interval = exemption ? scoreInterval(exemption) : null;
  const sectionResults = session.section_results as SectionResult[];
  // Scored sections only — the same basis as the score and /stats; the
  // experimental section is listed on its own below.
  const { correct: totalCorrect, total: totalQuestions } = scoredTotals(sectionResults);
  // How hard the scored questions were, by their own level: the context
  // that makes "x of y correct" readable next to an adaptive score.
  const scoredLevels = sectionResults
    .filter(sr => !isExperimentalSection(sr.sectionIndex))
    .flatMap(sr => (sr.questions ?? []).map(q => q?.difficulty_level))
    .filter((l): l is NonNullable<typeof l> => typeof l === 'number');
  const meanLevel = scoredLevels.length > 0
    ? Math.round(scoredLevels.reduce((a, l) => a + l, 0) / scoredLevels.length)
    : null;
  const anyCutTargeted = sectionResults.some(sr => sectionLevelTag(sr.sectionIndex, session.theta_history, sr.questions)?.cutTargeted);
  const hasExperimental = sectionResults.some(sr => SECTION_CONFIGS[sr.sectionIndex - 1]?.experimental);

  // By question type, scored sections only — the same tally /stats uses.
  const byType = aggregateAccuracyByType([{ section_results: sectionResults }]);

  return (
    <div className="min-h-dvh bg-exam-paper" dir="rtl">
      <BackNav backHref="/exam" backLabel="מבחן" />
      <main id="main" className="max-w-2xl mx-auto flex flex-col gap-7 pt-5 pb-24 px-4">
        <h1 className="sr-only">תוצאות המבחן</h1>
        <ResultsHero
          score={score}
          interval={interval}
          correct={totalCorrect}
          total={totalQuestions}
          meanLevel={meanLevel}
          hasExperimental={hasExperimental}
        />

        {between}

        {/* Score scale — flat on the page, the student's bracket lifted onto a card. */}
        <section aria-labelledby="results-scale-heading">
          <h2 id="results-scale-heading" className={HEADING}>סקאלת ציונים</h2>
          <p className="mt-1 mb-3 text-xs text-exam-ink-soft">
            כל מוסד לימודים קובע בעצמו את הסף המדויק לפטור ולכל רמה. הטווחים כאן הם הנפוצים ביותר, לא תקן אחיד.
          </p>
          <ul className="flex flex-col gap-1">
            {SCALE.map(row => {
              const mine = score >= row.min && score <= row.max;
              return (
                <li
                  key={row.range}
                  aria-current={mine ? 'true' : undefined}
                  className={`flex items-center gap-3 min-h-11 px-3 rounded-xl ${mine ? 'bg-exam-surface border border-exam-border shadow-surface' : ''}`}
                >
                  <span className="w-3.5 shrink-0">{row.min === 134 && <PlusMark className="size-3.5 fill-exam-sage" />}</span>
                  <bdi dir="ltr" className="w-[4.5rem] text-sm font-semibold text-exam-ink-soft tabular-nums text-start">{row.range}</bdi>
                  <span className={`text-sm ${mine ? 'font-bold text-exam-ink' : 'text-exam-ink'}`}>{row.label}</span>
                  {mine && <span className="ms-auto text-sm text-exam-ink-soft">הציון שלך <span className="font-extrabold text-exam-ink tabular-nums">{score}</span></span>}
                </li>
              );
            })}
          </ul>
        </section>

        {/* Breakdown by question type — recessed, like the type panel on /stats. */}
        <section aria-labelledby="results-types-heading" className="bg-exam-paper-alt rounded-[20px] shadow-pressed px-4 pt-[18px] pb-2">
          <h2 id="results-types-heading" className={`${HEADING} mb-3`}>פירוט לפי סוג שאלה</h2>
          <ul className="space-y-4 mb-4">
            {Object.entries(byType).filter(([, d]) => d.total > 0).map(([type, { correct, total }]) => {
              const pct = Math.round((correct / total) * 100);
              const t = tone(pct);
              return (
                <li key={type} data-type={type}>
                  <div className="flex items-baseline justify-between gap-2">
                    <span className="text-[15px] font-semibold text-exam-ink">{TYPE_LABELS[type] ?? type}</span>
                    <span className={`text-[22px] font-extrabold tracking-[-0.02em] tabular-nums ${t.text}`} dir="ltr">{pct}%</span>
                  </div>
                  <div className="relative h-2 mt-1.5 rounded-full bg-exam-paper" dir="ltr" aria-hidden>
                    <div className={`absolute inset-y-0 left-0 rounded-full ${t.bar}`} style={{ width: `${pct}%` }} />
                  </div>
                  <p className="mt-1 text-xs text-exam-ink-soft tabular-nums">{correct} נכונות מתוך {total}</p>
                </li>
              );
            })}
          </ul>

          <Disclosure label="פירוט לפי פרק, והמסלול האדפטיבי שלך">
            <p className="text-xs text-exam-ink-soft mb-3">
              התגית &quot;רמה X/5&quot; היא הרמה שאליה כיוון אותך האלגוריתם בכל פרק, לפי התשובות שלך עד אותו רגע. במבחן האמיתי, רק הגעה לרמות הגבוהות מאפשרת ציון גבוה.
              {anyCutTargeted && (
                <> בפרקים שמסומנים &quot;מכוון לסף הפטור&quot; הציון שלך היה קרוב ל-<bdi dir="ltr">134</bdi>, ולכן האלגוריתם כיוון את השאלות לסף עצמו כדי להכריע אם עברת אותו. שם התגית מציגה את רמת השאלות שקיבלת בפועל.</>
              )}
            </p>
            <ul className="space-y-3 pb-3">
              {sectionResults.filter(sr => sr.totalCount > 0).map(sr => {
                const cfg = SECTION_CONFIGS[sr.sectionIndex - 1];
                const pct = sr.totalCount > 0 ? Math.round((sr.correctCount / sr.totalCount) * 100) : 0;
                // Where the student's answers had routed them — or, for a
                // section aimed at the 134 cut, the level actually served.
                const tag = sectionLevelTag(sr.sectionIndex, session.theta_history, sr.questions);
                const isExperimental = cfg?.experimental === true;
                // It can't lower the score, so no red/amber — and a skipped
                // one says so instead of "0/4 · 0%".
                const skipped = isExperimental && isSkippedSection(sr);
                const barColor = isExperimental ? 'bg-exam-ink-soft/40' : tone(pct).bar;
                return (
                  <li key={sr.sectionIndex} className="flex items-center gap-3" data-section={sr.sectionIndex}>
                    <span className={`size-6 rounded-full text-xs grid place-items-center font-bold shrink-0 border tabular-nums ${
                      isExperimental ? 'bg-exam-alt-bg text-exam-alt border-exam-alt/40' : 'bg-exam-surface text-exam-accent border-exam-border'
                    }`}>
                      {sr.sectionIndex}
                    </span>
                    <div className="flex-1 min-w-0">
                      <div className="flex justify-between gap-2 text-sm mb-1">
                        <span className="text-exam-ink flex flex-wrap items-center gap-1.5">
                          {TYPE_LABELS[cfg?.type ?? sr.type]}
                          {isExperimental && (
                            <span className="px-1.5 py-0.5 rounded-sm bg-exam-alt-bg text-exam-alt text-[11px] font-semibold">תרגול חלופי</span>
                          )}
                          {tag && (
                            <span className="px-1.5 py-0.5 rounded-sm bg-exam-surface text-exam-ink-soft text-[11px] font-semibold tabular-nums">רמה <bdi dir="ltr">{tag.level}/5</bdi></span>
                          )}
                          {tag?.cutTargeted && (
                            <span className="px-1.5 py-0.5 rounded-sm bg-exam-surface text-exam-accent text-[11px] font-semibold">מכוון לסף הפטור</span>
                          )}
                        </span>
                        <span className="text-exam-ink-soft tabular-nums shrink-0">{skipped ? 'דילגת' : `${sr.correctCount}/${sr.totalCount}`}</span>
                      </div>
                      <div className="h-2 bg-exam-paper rounded-full overflow-hidden" dir="ltr" aria-hidden>
                        <div className={`h-full rounded-full ${barColor}`} style={{ width: `${skipped ? 0 : pct}%` }} />
                      </div>
                    </div>
                    <span className="text-sm font-medium text-exam-ink-soft w-10 text-left tabular-nums">{skipped ? '' : `${pct}%`}</span>
                  </li>
                );
              })}
            </ul>
          </Disclosure>
        </section>

        {/* Pace analysis — timed exams only, when timings were recorded */}
        {showPaceAnalysis(session.is_practice, sectionResults) && (() => {
          const PER_Q_BUDGET: Record<string, number> = { sentence_completion: 60, restatement: 120, reading_comprehension: 180 };
          const STUCK_CAP: Record<string, number> = { sentence_completion: 90, restatement: 150, reading_comprehension: 180 };
          const withTimings = sectionResults.filter(sr => sr.timings && sr.timings.length > 0);
          const overCap = withTimings.flatMap(sr => {
            const cfg = SECTION_CONFIGS[sr.sectionIndex - 1];
            const cap = STUCK_CAP[cfg?.type ?? sr.type] ?? 90;
            return (sr.timings ?? []).map((t, i) => ({ section: sr.sectionIndex, q: i + 1, t, cap,
              wrong: sr.answers?.[i] !== sr.questions?.[i]?.correct_answer })).filter(x => x.t > x.cap);
          });
          return (
            <section aria-labelledby="results-pace-heading">
              <h2 id="results-pace-heading" className={`${HEADING} flex items-center gap-1.5`}><Clock className="size-4" aria-hidden />ניתוח קצב</h2>
              <p className="mt-1 mb-3 text-xs text-exam-ink-soft">כמה זמן השקעת בכל פרק, לעומת הזמן שהוקצב לו</p>
              {overCap.length > 0 ? (
                <div className="p-3 bg-exam-alt-bg border border-exam-alt/40 rounded-xl">
                  <div className="text-sm font-semibold text-exam-alt mb-1 flex items-center gap-1.5">
                    <AlertTriangle className="size-4 shrink-0" aria-hidden />
                    {heCount(overCap.length, 'question')} {agree(overCap.length, 'חרגה', 'חרגו')}{' '}מ&quot;תקציב התקיעה&quot;
                  </div>
                  <div className="text-xs text-exam-alt leading-relaxed">
                    {overCap.slice(0, 4).map(x => `פרק ${x.section} שאלה ${x.q}: ${Math.round(x.t)} שנ׳${x.wrong ? ' (ועוד טעית בה. עדיף לנחש ולהתקדם)' : ''}`).join(' · ')}
                    {overCap.length > 4 && ` · ועוד ${overCap.length - 4}`}
                  </div>
                </div>
              ) : (
                <div className="p-3 bg-exam-sage-bg border border-exam-sage/40 rounded-xl text-sm text-exam-sage-strong font-medium flex items-center gap-1.5">
                  <CheckCircle2 className="size-4 shrink-0" aria-hidden />
                  קצב מצוין: אף שאלה לא חרגה מתקציב התקיעה
                </div>
              )}
              <div className="mt-4">
                <Disclosure label="הזמן בכל פרק">
                  <div className="space-y-3 pb-3">
                    {withTimings.map(sr => {
                      const cfg = SECTION_CONFIGS[sr.sectionIndex - 1];
                      const type = cfg?.type ?? sr.type;
                      const used = (sr.timings ?? []).reduce((a, b) => a + b, 0);
                      const budget = cfg?.durationSeconds ?? 240;
                      const pctUsed = Math.min(100, Math.round((used / budget) * 100));
                      const avg = Math.round(used / Math.max(1, (sr.timings ?? []).length));
                      const perQ = PER_Q_BUDGET[type] ?? 60;
                      return (
                        <div key={sr.sectionIndex}>
                          <div className="flex justify-between gap-2 text-sm mb-1">
                            <span className="text-exam-ink">פרק {sr.sectionIndex} — {TYPE_LABELS[type]}</span>
                            <span className={`text-xs tabular-nums ${avg > perQ ? 'text-exam-alt font-semibold' : 'text-exam-ink-soft'}`}>ממוצע {avg} שנ׳/שאלה</span>
                          </div>
                          <div className="h-2 bg-exam-paper-alt rounded-full overflow-hidden" dir="ltr" aria-hidden>
                            <div
                              className={`h-full rounded-full ${pctUsed >= 95 ? 'bg-exam-wrong' : pctUsed >= 75 ? 'bg-exam-alt' : 'bg-exam-sage-strong'}`}
                              style={{ width: `${pctUsed}%` }}
                            />
                          </div>
                          <div className="text-[11px] text-exam-ink-soft mt-0.5 tabular-nums">
                            השתמשת ב-{Math.round(used)} מתוך {budget} שניות ({pctUsed}%)
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </Disclosure>
              </div>
            </section>
          );
        })()}

        {/* Review all questions — a resting card, like the home cards. */}
        <Link href={`/review/${sessionId}`} className={`${CARD_LINK} flex items-center gap-3.5 p-4`}>
          <span className={`${ICON_TILE} size-11`}><BookOpen className="size-5" aria-hidden /></span>
          <span className="min-w-0">
            <span className="block font-bold text-[15px] text-exam-ink">עבור על כל השאלות ולמד מהטעויות</span>
            <span className="block text-sm text-exam-ink-soft mt-0.5">הסבר מפורט לכל שאלה, כולל פסילת המסיחים</span>
          </span>
          <ChevronLeft className="ms-auto size-5 shrink-0 text-exam-ink-soft" aria-hidden />
        </Link>

        <div className="flex gap-3">
          <Link
            href="/exam"
            className="flex-1 h-[52px] grid place-items-center bg-exam-accent text-exam-accent-ink rounded-2xl shadow-raised hover:brightness-110 active:shadow-pressed active:scale-[0.98] font-extrabold transition-[filter,box-shadow,transform] duration-300 ease-spring"
          >
            מבחן חדש
          </Link>
          <Link
            href="/stats"
            className="flex-1 h-[52px] grid place-items-center bg-exam-paper-alt text-exam-ink rounded-2xl hover:bg-exam-border/40 active:shadow-pressed active:scale-[0.98] font-bold transition-[background-color,box-shadow,transform] duration-300 ease-spring"
          >
            הסטטיסטיקה שלי
          </Link>
        </div>
      </main>
    </div>
  );
}
