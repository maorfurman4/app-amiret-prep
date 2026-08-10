'use client';

import { use, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { BackNav } from '@/components/BackNav';
import { AuthCTA } from '@/components/AuthCTA';
import { authFetch } from '@/lib/auth-fetch';
import { classifyScore, SECTION_CONFIGS, type SectionResult, type Question } from '@/types/exam';
import { thetaToScore } from '@/lib/adaptive';

interface SessionData {
  score: number;
  theta_final: number;
  theta_history: { after_section: number; theta: number }[];
  section_results: SectionResult[];
  answers_by_section: Record<number, (number | null)[]>;
  questions_by_section: Record<number, Question[]>;
  is_practice: boolean;
}

export default function ResultsPage({ params }: { params: Promise<{ sessionId: string }> }) {
  const { sessionId } = use(params);
  const router = useRouter();

  const [session, setSession] = useState<SessionData | null>(null);

  useEffect(() => {
    const guestId = localStorage.getItem('amiret_guest_id') ?? '';
    authFetch(`/api/exam/results?sessionId=${sessionId}&guestId=${encodeURIComponent(guestId)}`)
      .then(r => (r.ok ? r.json() : null))
      .then((d: { session: SessionData } | null) => {
        if (d?.session) setSession(d.session);
      });
  }, [sessionId]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!session) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-800/60">
        <div className="text-slate-400 dark:text-slate-500">טוען תוצאות...</div>
      </div>
    );
  }

  const score = session.score ?? thetaToScore(session.theta_final ?? 0);
  const classification = classifyScore(score);
  const sectionResults = session.section_results as SectionResult[];
  const totalCorrect = sectionResults.reduce((a, s) => a + (s.correctCount ?? 0), 0);
  const totalQuestions = sectionResults.reduce((a, s) => a + (s.totalCount ?? 0), 0);

  const TYPE_LABELS: Record<string, string> = {
    sentence_completion: 'השלמת משפטים',
    restatement: 'ניסוח מחדש',
    reading_comprehension: 'הבנת הנקרא',
    esra: 'אנגלית ESRA',
  };

  // Aggregate by question type
  const byType: Record<string, { correct: number; total: number }> = {};
  for (const sr of sectionResults) {
    const cfg = SECTION_CONFIGS[sr.sectionIndex - 1];
    const t = cfg?.type ?? sr.type;
    if (!byType[t]) byType[t] = { correct: 0, total: 0 };
    byType[t].correct += sr.correctCount ?? 0;
    byType[t].total += sr.totalCount ?? 0;
  }

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-900" dir="rtl">
      <BackNav backHref="/exam" backLabel="מבחן" />
      <div className="max-w-2xl mx-auto space-y-8 py-8 px-4">
        {/* Score card */}
        <div className="bg-white dark:bg-slate-800 rounded-3xl p-8 shadow-sm border border-slate-200 dark:border-slate-700 text-center">
          <div className="text-6xl font-black text-slate-900 dark:text-white mb-2">{score}</div>
          <div className={`text-xl font-bold mb-1 ${classification.color}`}>{classification.label}</div>
          <div className="text-slate-500 dark:text-slate-400 text-sm mb-6">{classification.description}</div>
          <div className="text-slate-700 dark:text-slate-200 font-medium">
            {totalCorrect} / {totalQuestions} תשובות נכונות
          </div>
          {sectionResults.some(sr => SECTION_CONFIGS[sr.sectionIndex - 1]?.experimental) && (
            <div className="text-xs text-slate-400 dark:text-slate-500 mt-1">
              כולל פרק ניסיוני — טעויות בו לא הורידו את הציון
            </div>
          )}
        </div>

        <AuthCTA message="התחבר כדי לשמור את הציון הזה ולהמשיך מכל מכשיר — כל מה שעשית עד עכשיו יעבור אוטומטית לחשבון." />

        {/* Score Prediction */}
        {(() => {
          const lo = Math.max(50, score - 10);
          const hi = Math.min(150, score + 10);
          const pct = Math.min(100, Math.max(0, ((score - 50) / 100) * 100));
          const loPct = Math.min(100, Math.max(0, ((lo - 50) / 100) * 100));
          const hiPct = Math.min(100, Math.max(0, ((hi - 50) / 100) * 100));
          const bands = [
            { min: 134, max: 150, label: 'פטור מלא — אין צורך בקורס אנגלית', color: 'bg-green-500' },
            { min: 120, max: 133, label: "מתקדמים ב' — קורס מקוצר אחד", color: 'bg-blue-500' },
            { min: 100, max: 119, label: "מתקדמים א' — קורס אחד", color: 'bg-yellow-500' },
            { min: 85,  max: 99,  label: 'בסיסי — שני קורסים', color: 'bg-orange-500' },
            { min: 70,  max: 84,  label: "טרום-בסיסי ב'", color: 'bg-red-500' },
            { min: 50,  max: 69,  label: "טרום-בסיסי א'", color: 'bg-red-700' },
          ];
          const currentBand = bands.find(b => score >= b.min && score <= b.max);
          return (
            <div className="bg-white dark:bg-slate-800 rounded-2xl p-6 shadow-sm border border-slate-200 dark:border-slate-700">
              <h2 className="font-bold text-slate-900 dark:text-white mb-1">תחזית ציון AMIRET</h2>
              <p className="text-slate-500 dark:text-slate-400 text-sm mb-4">
                על בסיס הביצועים שלך, הציון הצפוי הוא בטווח {lo}–{hi}
              </p>
              {/* Gradient score bar — RTL: low scores (50) on the right */}
              <div className="relative mb-5">
                <div className="h-5 rounded-full overflow-hidden flex">
                  <div className="bg-red-700"    style={{ width: '20%' }} />
                  <div className="bg-red-400"    style={{ width: '15%' }} />
                  <div className="bg-orange-400" style={{ width: '15%' }} />
                  <div className="bg-yellow-400" style={{ width: '20%' }} />
                  <div className="bg-blue-400"   style={{ width: '14%' }} />
                  <div className="bg-green-500"  style={{ width: '16%' }} />
                </div>
                {/* Range bracket */}
                <div
                  className="absolute top-0 h-5 border-2 border-slate-800 rounded bg-white/30"
                  style={{ right: `${loPct}%`, width: `${Math.max(hiPct - loPct, 2)}%` }}
                />
                {/* Current score needle */}
                <div
                  className="absolute -top-0.5 w-0.5 h-6 bg-slate-900"
                  style={{ right: `calc(${pct}% - 1px)` }}
                />
                <div className="flex justify-between text-xs text-slate-400 dark:text-slate-500 mt-1.5">
                  <span>50</span>
                  <span>150</span>
                </div>
              </div>
              {currentBand && (
                <div className="flex items-center gap-2 p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700">
                  <div className={`w-3 h-3 rounded-full flex-shrink-0 ${currentBand.color}`} />
                  <span className="text-sm font-semibold text-slate-800 dark:text-slate-100">{currentBand.label}</span>
                </div>
              )}
            </div>
          );
        })()}

        {/* Score scale */}
        <div className="bg-white dark:bg-slate-800 rounded-2xl p-6 shadow-sm border border-slate-200 dark:border-slate-700">
          <h2 className="font-bold text-slate-900 dark:text-white mb-4">סקאלת ציונים</h2>
          {[
            { range: '134–150', label: 'פטור מלא', color: 'bg-green-500', min: 134, max: 150 },
            { range: '120–133', label: 'מתקדמים ב\'', color: 'bg-blue-500', min: 120, max: 133 },
            { range: '100–119', label: 'מתקדמים א\'', color: 'bg-yellow-500', min: 100, max: 119 },
            { range: '85–99',  label: 'בסיסי', color: 'bg-orange-500', min: 85, max: 99 },
            { range: '70–84',  label: 'טרום-בסיסי ב\'', color: 'bg-red-500', min: 70, max: 84 },
            { range: '50–69',  label: 'טרום-בסיסי א\'', color: 'bg-red-700', min: 50, max: 69 },
          ].map(row => (
            <div key={row.range} className={`flex items-center gap-3 p-3 rounded-xl mb-2 ${
              score >= row.min && score <= row.max ? 'bg-slate-100 dark:bg-slate-700 ring-2 ring-blue-400' : ''
            }`}>
              <div className={`w-3 h-3 rounded-full ${row.color}`} />
              <span className="font-mono text-sm text-slate-600 dark:text-slate-300">{row.range}</span>
              <span className="text-sm text-slate-800 dark:text-slate-100">{row.label}</span>
            </div>
          ))}
        </div>

        {/* Breakdown by question type */}
        <div className="bg-white dark:bg-slate-800 rounded-2xl p-6 shadow-sm border border-slate-200 dark:border-slate-700">
          <h2 className="font-bold text-slate-900 dark:text-white mb-4">פירוט לפי סוג שאלה</h2>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-5">
            {Object.entries(byType).map(([type, { correct, total }]) => {
              const pct = total > 0 ? Math.round((correct / total) * 100) : 0;
              const color = pct >= 75 ? 'text-green-600 bg-green-50 border-green-200'
                : pct >= 50 ? 'text-yellow-600 bg-yellow-50 border-yellow-200'
                : 'text-red-600 bg-red-50 border-red-200';
              return (
                <div key={type} className={`p-3 rounded-xl border text-center ${color}`}>
                  <div className="text-2xl font-black">{correct}/{total}</div>
                  <div className="text-xs font-semibold mt-1">{TYPE_LABELS[type] ?? type}</div>
                  <div className="text-xs opacity-75">{pct}%</div>
                </div>
              );
            })}
          </div>

          <h3 className="font-semibold text-slate-700 dark:text-slate-200 text-sm mb-3">פירוט לפי פרק — והמסלול האדפטיבי שלך</h3>
          <p className="text-xs text-slate-400 dark:text-slate-500 mb-3">
            רמה 1–5 = רמת הקושי שאליה ניתב אותך האלגוריתם בכל פרק. במבחן האמיתי, רק הגעה לרמות הגבוהות מאפשרת ציון גבוה.
          </p>
          <div className="space-y-3">
            {sectionResults.map((sr) => {
              const cfg = SECTION_CONFIGS[sr.sectionIndex - 1];
              const pct = sr.totalCount > 0 ? Math.round((sr.correctCount / sr.totalCount) * 100) : 0;
              const difficulty = sr.questions?.[0]?.difficulty_level;
              const isExperimental = cfg?.experimental === true;
              return (
                <div key={sr.sectionIndex} className="flex items-center gap-3">
                  <div className={`w-6 h-6 rounded-full text-xs flex items-center justify-center font-bold flex-shrink-0 ${
                    isExperimental ? 'bg-purple-100 text-purple-700' : 'bg-blue-100 text-blue-700'
                  }`}>
                    {sr.sectionIndex}
                  </div>
                  <div className="flex-1">
                    <div className="flex justify-between text-sm mb-1">
                      <span className="text-slate-700 dark:text-slate-200 flex items-center gap-1.5">
                        {TYPE_LABELS[cfg?.type ?? sr.type]}
                        {isExperimental && (
                          <span className="px-1.5 py-0.5 rounded bg-purple-100 text-purple-700 text-[10px] font-semibold">ניסיוני</span>
                        )}
                        {difficulty && (
                          <span className="px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-400 text-[10px] font-mono">רמה {difficulty}/5</span>
                        )}
                      </span>
                      <span className="text-slate-500 dark:text-slate-400">{sr.correctCount}/{sr.totalCount}</span>
                    </div>
                    <div className="h-2 bg-slate-100 dark:bg-slate-700 rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all ${
                          pct >= 75 ? 'bg-green-500' : pct >= 50 ? 'bg-yellow-500' : 'bg-red-500'
                        }`}
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>
                  <span className="text-sm font-medium text-slate-600 dark:text-slate-300 w-10 text-left">{pct}%</span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Pace analysis — shown only when timings were recorded */}
        {sectionResults.some(sr => sr.timings && sr.timings.length > 0) && (() => {
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
            <div className="bg-white dark:bg-slate-800 rounded-2xl p-6 shadow-sm border border-slate-200 dark:border-slate-700">
              <h2 className="font-bold text-slate-900 dark:text-white mb-1">⏱️ ניתוח קצב</h2>
              <p className="text-xs text-slate-400 dark:text-slate-500 mb-4">
                כמה זמן השקעת בכל פרק ביחס לתקציב — קצב הוא חצי מהציון באמירנ"ט
              </p>
              <div className="space-y-3 mb-4">
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
                      <div className="flex justify-between text-sm mb-1">
                        <span className="text-slate-700 dark:text-slate-200">
                          פרק {sr.sectionIndex} — {TYPE_LABELS[type]}
                        </span>
                        <span className={`font-mono text-xs ${avg > perQ ? 'text-orange-500' : 'text-slate-500 dark:text-slate-400'}`}>
                          ממוצע {avg} שנ׳/שאלה
                        </span>
                      </div>
                      <div className="h-2 bg-slate-100 dark:bg-slate-700 rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full ${pctUsed >= 95 ? 'bg-red-500' : pctUsed >= 75 ? 'bg-yellow-500' : 'bg-green-500'}`}
                          style={{ width: `${pctUsed}%` }}
                        />
                      </div>
                      <div className="text-[11px] text-slate-400 dark:text-slate-500 mt-0.5">
                        נוצלו {Math.round(used)} מתוך {budget} שניות ({pctUsed}%)
                      </div>
                    </div>
                  );
                })}
              </div>
              {overCap.length > 0 ? (
                <div className="p-3 bg-orange-50 dark:bg-orange-950/30 border border-orange-200 dark:border-orange-800 rounded-xl">
                  <div className="text-sm font-semibold text-orange-800 dark:text-orange-300 mb-1">
                    ⚠️ {overCap.length} שאלות חרגו מ"תקציב התקיעה"
                  </div>
                  <div className="text-xs text-orange-700 dark:text-orange-400 leading-relaxed">
                    {overCap.slice(0, 4).map(x => `פרק ${x.section} שאלה ${x.q}: ${Math.round(x.t)} שנ׳${x.wrong ? ' (וגם שגויה — נחש ותתקדם!)' : ''}`).join(' · ')}
                    {overCap.length > 4 && ` · ועוד ${overCap.length - 4}`}
                  </div>
                </div>
              ) : (
                <div className="p-3 bg-green-50 dark:bg-green-950/30 border border-green-200 dark:border-green-800 rounded-xl text-sm text-green-800 dark:text-green-300 font-medium">
                  ✓ קצב מצוין — אף שאלה לא חרגה מתקציב התקיעה
                </div>
              )}
            </div>
          );
        })()}

        {/* Review all questions */}
        <Link href={`/review/${sessionId}`} className="block">
          <div className="bg-blue-50 border border-blue-200 rounded-2xl p-5 flex items-center gap-4 hover:bg-blue-100 transition-colors cursor-pointer">
            <div className="text-3xl">📖</div>
            <div>
              <div className="font-bold text-blue-900">עבור על כל השאלות ולמד מהטעויות</div>
              <div className="text-blue-600 text-sm">ראה הסברים מפורטים לכל שאלה עם שלבי שלילה</div>
            </div>
            <div className="mr-auto text-blue-400 text-xl">›</div>
          </div>
        </Link>

        {/* Actions */}
        <div className="flex gap-3">
          <button
            onClick={() => router.push('/exam')}
            className="flex-1 py-3 bg-blue-600 text-white rounded-xl font-semibold hover:bg-blue-700 transition-colors"
          >
            מבחן חדש
          </button>
          <button
            onClick={() => router.push('/stats')}
            className="flex-1 py-3 bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-200 rounded-xl font-semibold hover:bg-slate-200 transition-colors"
          >
            הסטטיסטיקה שלי
          </button>
        </div>
      </div>
    </div>
  );
}
