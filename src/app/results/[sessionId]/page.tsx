'use client';

import { use, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { BackNav } from '@/components/BackNav';
import { AuthCTA } from '@/components/AuthCTA';
import { AlertTriangle, CheckCircle2, BookOpen, Clock } from 'lucide-react';
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
  const [error, setError] = useState(false);
  const [loadToken, setLoadToken] = useState(0);

  useEffect(() => {
    let cancelled = false;
    const guestId = localStorage.getItem('amiret_guest_id') ?? '';
    authFetch(`/api/exam/results?sessionId=${sessionId}&guestId=${encodeURIComponent(guestId)}`)
      .then(r => {
        // Not finished yet — the API refuses (403); send them back into the exam.
        if (r.status === 403) { router.replace(`/exam/${sessionId}`); return null; }
        if (!r.ok) throw new Error(`results fetch failed: ${r.status}`);
        return r.json();
      })
      .then((d: { session: SessionData } | null) => {
        if (cancelled) return;
        if (d?.session) setSession(d.session);
      })
      .catch(() => { if (!cancelled) setError(true); });
    return () => { cancelled = true; };
  }, [sessionId, loadToken]); // eslint-disable-line react-hooks/exhaustive-deps

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-exam-paper px-4" dir="rtl">
        <div className="text-center space-y-4 max-w-sm">
          <AlertTriangle className="w-10 h-10 mx-auto text-exam-wrong" strokeWidth={1.5} aria-hidden />
          <p className="text-exam-ink-soft text-sm">לא הצלחנו לטעון את התוצאות. בדוק את החיבור ונסה שוב.</p>
          <button
            onClick={() => { setError(false); setLoadToken(t => t + 1); }}
            className="px-6 py-2.5 bg-exam-accent text-exam-accent-ink rounded-sm font-semibold hover:opacity-90 transition-opacity"
          >
            נסה שוב
          </button>
        </div>
      </div>
    );
  }

  if (!session) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-exam-paper">
        <div className="text-exam-ink-soft">טוען תוצאות...</div>
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
    <div className="min-h-screen bg-exam-paper" dir="rtl">
      <BackNav backHref="/exam" backLabel="מבחן" />
      <div className="max-w-2xl mx-auto space-y-8 py-8 px-4">
        {/* Score card */}
        <div className="bg-exam-surface rounded-md p-8 border border-exam-border text-center">
          <div className="text-xs text-exam-ink-soft mb-1">אומדן פנימי של האתר</div>
          <div className="text-6xl font-black text-exam-ink mb-2">{score}</div>
          <div className={`text-xl font-bold mb-1 ${classification.color}`}>{classification.label}</div>
          <div className="text-exam-ink-soft text-sm mb-6">{classification.description}</div>
          <div className="text-exam-ink font-medium">
            {totalCorrect} / {totalQuestions} תשובות נכונות
          </div>
          {sectionResults.some(sr => SECTION_CONFIGS[sr.sectionIndex - 1]?.experimental) && (
            <div className="text-xs text-exam-ink-soft mt-1">
              כולל תרגול חלופי — הוא אינו חלק מהדמיית פרקי הליבה וטעויות בו לא הורידו את האומדן
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
            { min: 134, max: 150, label: 'פטור מלא — אין צורך בקורס אנגלית', color: 'bg-exam-sage-strong' },
            { min: 120, max: 133, label: "מתקדמים ב' — קורס מקוצר אחד", color: 'bg-exam-accent' },
            { min: 100, max: 119, label: "מתקדמים א' — קורס אחד", color: 'bg-exam-alt' },
            { min: 85,  max: 99,  label: 'בסיסי — שני קורסים', color: 'bg-exam-alt' },
            { min: 70,  max: 84,  label: "טרום-בסיסי ב'", color: 'bg-exam-wrong' },
            { min: 50,  max: 69,  label: "טרום-בסיסי א'", color: 'bg-exam-wrong' },
          ];
          const currentBand = bands.find(b => score >= b.min && score <= b.max);
          return (
            <div className="bg-exam-surface rounded-md p-6 border border-exam-border">
              <h2 className="font-bold text-exam-ink mb-1">הערכת טווח ציון</h2>
              <p className="text-exam-ink-soft text-sm mb-4">
                על בסיס הביצועים שלך כאן, הטווח המוערך הוא {lo}–{hi} — אומדן פנימי של האתר, לא ציון רשמי של מאל&quot;ו
              </p>
              {/* Gradient score bar — RTL: low scores (50) on the right */}
              <div className="relative mb-5">
                <div className="h-5 rounded-full overflow-hidden flex">
                  <div className="bg-exam-wrong"        style={{ width: '20%' }} />
                  <div className="bg-exam-wrong/70"     style={{ width: '15%' }} />
                  <div className="bg-exam-alt/70"       style={{ width: '15%' }} />
                  <div className="bg-exam-alt"          style={{ width: '20%' }} />
                  <div className="bg-exam-accent/70"    style={{ width: '14%' }} />
                  <div className="bg-exam-sage-strong"  style={{ width: '16%' }} />
                </div>
                {/* Range bracket */}
                <div
                  className="absolute top-0 h-5 border-2 border-exam-ink rounded-sm bg-exam-surface/40"
                  style={{ right: `${loPct}%`, width: `${Math.max(hiPct - loPct, 2)}%` }}
                />
                {/* Current score needle */}
                <div
                  className="absolute -top-0.5 w-0.5 h-6 bg-exam-ink"
                  style={{ right: `calc(${pct}% - 1px)` }}
                />
                <div className="flex justify-between text-xs text-exam-ink-soft mt-1.5">
                  <span>50</span>
                  <span>150</span>
                </div>
              </div>
              {currentBand && (
                <div className="flex items-center gap-2 p-3 rounded-sm bg-exam-paper-alt border border-exam-border">
                  <div className={`w-3 h-3 rounded-full flex-shrink-0 ${currentBand.color}`} />
                  <span className="text-sm font-semibold text-exam-ink">{currentBand.label}</span>
                </div>
              )}
            </div>
          );
        })()}

        {/* Score scale */}
        <div className="bg-exam-surface rounded-md p-6 border border-exam-border">
          <h2 className="font-bold text-exam-ink mb-1">סקאלת ציונים</h2>
          <p className="text-xs text-exam-ink-soft mb-4">
            הסף המדויק לפטור/רמה נקבע בנפרד על ידי כל מוסד לימודים — הטווחים כאן הם הנפוצים ביותר בפועל, לא תקן מחייב אחיד.
          </p>
          {[
            { range: '134–150', label: 'פטור מלא', color: 'bg-exam-sage-strong', min: 134, max: 150 },
            { range: '120–133', label: 'מתקדמים ב\'', color: 'bg-exam-accent', min: 120, max: 133 },
            { range: '100–119', label: 'מתקדמים א\'', color: 'bg-exam-alt', min: 100, max: 119 },
            { range: '85–99',  label: 'בסיסי', color: 'bg-exam-alt', min: 85, max: 99 },
            { range: '70–84',  label: 'טרום-בסיסי ב\'', color: 'bg-exam-wrong', min: 70, max: 84 },
            { range: '50–69',  label: 'טרום-בסיסי א\'', color: 'bg-exam-wrong', min: 50, max: 69 },
          ].map(row => (
            <div key={row.range} className={`flex items-center gap-3 p-3 rounded-sm mb-2 ${
              score >= row.min && score <= row.max ? 'bg-exam-paper-alt ring-2 ring-exam-accent' : ''
            }`}>
              <div className={`w-3 h-3 rounded-full ${row.color}`} />
              <span className="font-mono text-sm text-exam-ink-soft">{row.range}</span>
              <span className="text-sm text-exam-ink">{row.label}</span>
            </div>
          ))}
        </div>

        {/* Breakdown by question type */}
        <div className="bg-exam-surface rounded-md p-6 border border-exam-border">
          <h2 className="font-bold text-exam-ink mb-4">פירוט לפי סוג שאלה</h2>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-5">
            {Object.entries(byType).map(([type, { correct, total }]) => {
              const pct = total > 0 ? Math.round((correct / total) * 100) : 0;
              const color = pct >= 75 ? 'text-exam-sage-strong bg-exam-sage-bg border-exam-sage/40'
                : pct >= 50 ? 'text-exam-alt bg-exam-alt-bg border-exam-alt/40'
                : 'text-exam-wrong bg-exam-wrong-bg border-exam-wrong/40';
              return (
                <div key={type} className={`p-3 rounded-sm border text-center ${color}`}>
                  <div className="text-2xl font-black">{correct}/{total}</div>
                  <div className="text-xs font-semibold mt-1">{TYPE_LABELS[type] ?? type}</div>
                  <div className="text-xs opacity-75">{pct}%</div>
                </div>
              );
            })}
          </div>

          <h3 className="font-semibold text-exam-ink text-sm mb-3">פירוט לפי פרק — והמסלול האדפטיבי שלך</h3>
          <p className="text-xs text-exam-ink-soft mb-3">
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
                  <div className={`w-6 h-6 rounded-full text-xs flex items-center justify-center font-bold flex-shrink-0 border ${
                    isExperimental ? 'bg-exam-alt-bg text-exam-alt border-exam-alt/40' : 'bg-exam-accent/10 text-exam-accent border-exam-accent/30'
                  }`}>
                    {sr.sectionIndex}
                  </div>
                  <div className="flex-1">
                    <div className="flex justify-between text-sm mb-1">
                      <span className="text-exam-ink flex items-center gap-1.5">
                        {TYPE_LABELS[cfg?.type ?? sr.type]}
                        {isExperimental && (
                          <span className="px-1.5 py-0.5 rounded-sm bg-exam-alt-bg text-exam-alt text-[10px] font-semibold">תרגול חלופי</span>
                        )}
                        {difficulty && (
                          <span className="px-1.5 py-0.5 rounded-sm bg-exam-paper-alt text-exam-ink-soft text-[10px] font-mono">רמה {difficulty}/5</span>
                        )}
                      </span>
                      <span className="text-exam-ink-soft">{sr.correctCount}/{sr.totalCount}</span>
                    </div>
                    <div className="h-2 bg-exam-paper-alt rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all ${
                          pct >= 75 ? 'bg-exam-sage-strong' : pct >= 50 ? 'bg-exam-alt' : 'bg-exam-wrong'
                        }`}
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>
                  <span className="text-sm font-medium text-exam-ink-soft w-10 text-left">{pct}%</span>
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
            <div className="bg-exam-surface rounded-md p-6 border border-exam-border">
              <h2 className="font-bold text-exam-ink mb-1 flex items-center gap-1.5"><Clock className="w-4 h-4" aria-hidden />ניתוח קצב</h2>
              <p className="text-xs text-exam-ink-soft mb-4">
                כמה זמן השקעת בכל פרק ביחס לזמן המוקצב — ניהול זמן עוזר להשלים את הפרק
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
                        <span className="text-exam-ink">
                          פרק {sr.sectionIndex} — {TYPE_LABELS[type]}
                        </span>
                        <span className={`font-mono text-xs ${avg > perQ ? 'text-exam-alt' : 'text-exam-ink-soft'}`}>
                          ממוצע {avg} שנ׳/שאלה
                        </span>
                      </div>
                      <div className="h-2 bg-exam-paper-alt rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full ${pctUsed >= 95 ? 'bg-exam-wrong' : pctUsed >= 75 ? 'bg-exam-alt' : 'bg-exam-sage-strong'}`}
                          style={{ width: `${pctUsed}%` }}
                        />
                      </div>
                      <div className="text-[11px] text-exam-ink-soft mt-0.5">
                        נוצלו {Math.round(used)} מתוך {budget} שניות ({pctUsed}%)
                      </div>
                    </div>
                  );
                })}
              </div>
              {overCap.length > 0 ? (
                <div className="p-3 bg-exam-alt-bg border border-exam-alt/40 rounded-sm">
                  <div className="text-sm font-semibold text-exam-alt mb-1 flex items-center gap-1.5">
                    <AlertTriangle className="w-4 h-4 flex-shrink-0" aria-hidden />
                    {overCap.length} שאלות חרגו מ&quot;תקציב התקיעה&quot;
                  </div>
                  <div className="text-xs text-exam-alt leading-relaxed">
                    {overCap.slice(0, 4).map(x => `פרק ${x.section} שאלה ${x.q}: ${Math.round(x.t)} שנ׳${x.wrong ? ' (וגם שגויה — נחש ותתקדם!)' : ''}`).join(' · ')}
                    {overCap.length > 4 && ` · ועוד ${overCap.length - 4}`}
                  </div>
                </div>
              ) : (
                <div className="p-3 bg-exam-sage-bg border border-exam-sage/40 rounded-sm text-sm text-exam-sage-strong font-medium flex items-center gap-1.5">
                  <CheckCircle2 className="w-4 h-4 flex-shrink-0" aria-hidden />
                  קצב מצוין — אף שאלה לא חרגה מתקציב התקיעה
                </div>
              )}
            </div>
          );
        })()}

        {/* Review all questions */}
        <Link href={`/review/${sessionId}`} className="block">
          <div className="bg-exam-surface border border-exam-border rounded-sm p-5 flex items-center gap-4 hover:bg-exam-paper-alt hover:border-exam-border-strong transition-colors cursor-pointer">
            <BookOpen className="w-8 h-8 text-exam-ink-soft flex-shrink-0" strokeWidth={1.5} aria-hidden />
            <div>
              <div className="font-bold text-exam-ink">עבור על כל השאלות ולמד מהטעויות</div>
              <div className="text-exam-ink-soft text-sm">ראה הסברים מפורטים לכל שאלה עם שלבי שלילה</div>
            </div>
            <div className="mr-auto text-exam-ink-soft text-xl">›</div>
          </div>
        </Link>

        {/* Actions */}
        <div className="flex gap-3">
          <button
            onClick={() => router.push('/exam')}
            className="flex-1 py-3 bg-exam-accent text-exam-accent-ink rounded-sm font-semibold hover:opacity-90 transition-opacity"
          >
            מבחן חדש
          </button>
          <button
            onClick={() => router.push('/stats')}
            className="flex-1 py-3 bg-exam-paper-alt text-exam-ink rounded-sm font-semibold hover:bg-exam-border/40 transition-colors"
          >
            הסטטיסטיקה שלי
          </button>
        </div>
      </div>
    </div>
  );
}
