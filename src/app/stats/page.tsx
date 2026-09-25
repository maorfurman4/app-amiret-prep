'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase';
import { authFetch } from '@/lib/auth-fetch';
import { classifyScore, SECTION_CONFIGS, type SectionResult } from '@/types/exam';
import { routeNextDifficulty, thetaToScore } from '@/lib/adaptive';
import { currentEstimate, sessionMeasurement, type Measurement } from '@/lib/exemption';
import { ExemptionCard, ExemptTarget } from '@/components/results/ExemptionCard';
import { aggregateAccuracyByType, findWeakestType } from '@/lib/weakness';
import { BackNav } from '@/components/BackNav';
import { VictoryPath } from '@/components/stats/VictoryPath';
import { BarChart3, Target, Check, Trophy, AlertTriangle, PartyPopper } from 'lucide-react';
import { heCount, agree } from '@/lib/hebrew-count';

interface Stats {
  total_exams: number;
  best_score: number | null;
  avg_score: number | null;
  score_history: { date: string; score: number }[];
  performance_by_type: Record<string, { correct: number; total: number }>;
}

/** One completed exam, as /api/stats returns it. */
interface StatsRow {
  score: number;
  completed_at: string;
  section_results: unknown;
  theta_final?: number | null;
  theta_se?: number | null;
  p_exempt?: number | null;
}

interface WeaknessData {
  byType: Record<string, { correct: number; total: number }>;
  byDifficulty: Record<string, { correct: number; total: number }>;
}

const TYPE_LABELS: Record<string, string> = {
  sentence_completion: 'השלמת משפטים',
  restatement: 'ניסוח מחדש',
  reading_comprehension: 'הבנת הנקרא',
  esra: 'אנגלית ESRA',
};

const DIFFICULTY_LABELS: Record<string, string> = {
  easy: 'קל',
  medium: 'בינוני',
  hard: 'קשה',
};

export default function StatsPage() {
  const supabase = createClient();
  const [stats, setStats] = useState<Stats | null>(null);
  const [rawRows, setRawRows] = useState<StatsRow[]>([]);
  const [weakness, setWeakness] = useState<WeaknessData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [loadToken, setLoadToken] = useState(0);

  useEffect(() => {
    let cancelled = false;
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (cancelled) return;
      // Works for both logged-in users and guests — stats are computed
      // directly from completed exam sessions, keyed by the same user_id
      // the exam APIs write (auth id or the localStorage guest UUID).
      const userKey = user?.id ?? localStorage.getItem('amiret_guest_id');
      if (!userKey) {
        setLoading(false);
        return;
      }

      authFetch(`/api/stats?guestId=${encodeURIComponent(localStorage.getItem('amiret_guest_id') ?? '')}`)
        .then(r => { if (!r.ok) throw new Error(`stats fetch failed: ${r.status}`); return r.json(); })
        .then((d: { sessions: StatsRow[] }) => {
          if (cancelled) return;
          const rows = d.sessions ?? [];

          if (rows.length === 0) {
            setStats({ total_exams: 0, best_score: null, avg_score: null, score_history: [], performance_by_type: {} });
            setLoading(false);
            return;
          }

          const scores = rows.map(r => r.score);
          const recent = rows.slice(-10);

          // Per-type accuracy: all-time (for the performance breakdown) and
          // last-10 (for the weakness analysis) — same shared aggregator the
          // "today's session" weak-area pick uses, so both surfaces agree on
          // what "your weakness" means (src/lib/weakness.ts).
          const performanceByType = aggregateAccuracyByType(rows);
          const byType = aggregateAccuracyByType(recent);

          const byDifficulty: Record<string, { correct: number; total: number }> = {};
          for (const row of recent) {
            for (const sr of ((row.section_results ?? []) as SectionResult[])) {
              // Aggregate by difficulty from the section's question level (1-5)
              const level = (sr.questions?.[0] as { difficulty_level?: number } | undefined)?.difficulty_level;
              if (level) {
                const bucket = level <= 2 ? 'easy' : level === 3 ? 'medium' : 'hard';
                if (!byDifficulty[bucket]) byDifficulty[bucket] = { correct: 0, total: 0 };
                byDifficulty[bucket].correct += sr.correctCount ?? 0;
                byDifficulty[bucket].total += sr.totalCount ?? 0;
              }
            }
          }

          setRawRows(rows);
          setStats({
            total_exams: rows.length,
            best_score: Math.max(...scores),
            avg_score: scores.reduce((a, b) => a + b, 0) / scores.length,
            score_history: rows.map(r => ({ date: r.completed_at, score: r.score })),
            performance_by_type: performanceByType,
          });
          setWeakness({ byType, byDifficulty });
          setLoading(false);
        })
        .catch(() => {
          if (cancelled) return;
          setError(true);
          setLoading(false);
        });
    });
    return () => { cancelled = true; };
  }, [loadToken]); // eslint-disable-line react-hooks/exhaustive-deps

  if (error) {
    return (
      <div className="min-h-dvh bg-exam-paper" dir="rtl">
        <BackNav backHref="/exam" backLabel="מבחן" />
        <div className="flex flex-col items-center justify-center h-[calc(100dvh-3rem)] text-center px-4">
          <AlertTriangle className="w-12 h-12 mx-auto mb-4 text-exam-wrong" strokeWidth={1.5} aria-hidden />
          <p className="text-exam-ink-soft mb-6">לא הצלחנו לטעון את הסטטיסטיקה. בדוק את החיבור ונסה שוב.</p>
          <button
            onClick={() => { setError(false); setLoading(true); setLoadToken(t => t + 1); }}
            className="px-6 py-3 bg-exam-accent text-exam-accent-ink rounded-2xl shadow-raised hover:shadow-overlay active:shadow-pressed hover:-translate-y-1 active:translate-y-0 active:scale-[0.98] font-semibold transition-[box-shadow,transform] duration-300 ease-spring will-change-transform"
          >
            נסה שוב
          </button>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="min-h-dvh bg-exam-paper" dir="rtl">
        <BackNav backHref="/exam" backLabel="מבחן" />
        <div className="flex items-center justify-center h-[calc(100dvh-3rem)] text-exam-ink-soft">טוען...</div>
      </div>
    );
  }

  if (!stats || stats.total_exams === 0) {
    return (
      <div className="min-h-dvh bg-exam-paper" dir="rtl">
        <BackNav backHref="/exam" backLabel="מבחן" />
        <div className="flex flex-col items-center justify-center h-[calc(100dvh-3rem)] text-center px-4">
          <BarChart3 className="w-14 h-14 mx-auto mb-4 text-exam-ink-soft" strokeWidth={1.5} aria-hidden />
          <h1 className="text-2xl font-bold text-exam-ink mb-2">הסטטיסטיקה שלך מחכה למבחן הראשון</h1>
          <p className="text-exam-ink-soft mb-6">אחרי סימולציה אחת תראה כאן את הציון שלך, את החוזקות ואת מה שכדאי לחזק.</p>
          <Link href="/exam" className="px-6 py-3 bg-exam-accent text-exam-accent-ink rounded-2xl shadow-raised hover:shadow-overlay active:shadow-pressed hover:-translate-y-1 active:translate-y-0 active:scale-[0.98] font-semibold transition-[box-shadow,transform] duration-300 ease-spring will-change-transform">
            התחל מבחן
          </Link>
        </div>
      </div>
    );
  }

  const classification = stats.best_score ? classifyScore(stats.best_score) : null;

  // Find weakest type for the weakness analysis section — same "worst
  // accuracy wins" policy src/lib/weakness.ts uses for today's session.
  const weakestType = weakness ? findWeakestType(weakness.byType) : null;

  return (
    <div className="min-h-dvh bg-exam-paper" dir="rtl">
      <BackNav backHref="/exam" backLabel="מבחן" />
      <div className="max-w-2xl mx-auto space-y-6 py-8 px-4">
        <h1 className="text-2xl font-bold text-exam-ink">הסטטיסטיקה שלי</h1>

        {/* Current probability of 134+: the last few exams pooled by their
            measurement precision, leaving out any clearly below the latest
            one (src/lib/exemption.ts currentEstimate) — steadier than any
            single exam, yet a real breakthrough shows up immediately. */}
        {(() => {
          const current = currentEstimate(rawRows
            .map(sessionMeasurement)
            .filter((m): m is Measurement => m !== null));
          if (!current) return null;
          const basis = current.used === 1 ? 'המבחן האחרון שלך' : `${current.used} המבחנים האחרונים שלך`;
          return (
            <ExemptionCard
              measurement={current.measurement}
              heading={<>הסיכוי שלך ל-<ExemptTarget /> כרגע</>}
              basis={current.dropped > 0
                ? `${basis}. לא כללנו מבחנים קודמים שהיו נמוכים בבירור, כי התקדמת מאז`
                : basis}
              score={thetaToScore(current.measurement.theta)}
            />
          );
        })()}

        {/* Readiness report — ready / almost / not yet, with reasons */}
        {rawRows.length >= 1 && (() => {
          const last3 = rawRows.slice(-3).map(r => r.score);
          const avg3 = last3.reduce((a, b) => a + b, 0) / last3.length;
          const spread = last3.length >= 2 ? Math.max(...last3) - Math.min(...last3) : 0;
          // per-type accuracy + high-level survival over last 3 exams
          const typeAcc: Record<string, { c: number; t: number }> = {};
          let hiCorrect = 0, hiTotal = 0, overCap = 0, timedQ = 0;
          const CAPS: Record<string, number> = { sentence_completion: 90, restatement: 150, reading_comprehension: 180 };
          for (const row of rawRows.slice(-3)) {
            for (const sr of ((row.section_results ?? []) as SectionResult[])) {
              const cfg = SECTION_CONFIGS[sr.sectionIndex - 1];
              const t = cfg?.type ?? sr.type;
              if (!typeAcc[t]) typeAcc[t] = { c: 0, t: 0 };
              typeAcc[t].c += sr.correctCount ?? 0; typeAcc[t].t += sr.totalCount ?? 0;
              const lvl = (sr.questions?.[0] as { difficulty_level?: number })?.difficulty_level ?? 0;
              if (lvl >= 4) { hiCorrect += sr.correctCount ?? 0; hiTotal += sr.totalCount ?? 0; }
              (sr.timings ?? []).forEach(sec => { timedQ++; if (sec > (CAPS[t] ?? 90)) overCap++; });
            }
          }
          const reasons: { ok: boolean; text: string; href?: string }[] = [];
          reasons.push({ ok: rawRows.length >= 3, text: rawRows.length >= 3 ? `השלמת ${rawRows.length} מבחנים` : `רק ${heCount(rawRows.length, 'exam')}. צריך לפחות 3 למדידה יציבה`, href: rawRows.length >= 3 ? undefined : '/exam' });
          reasons.push({ ok: avg3 >= 134, text: `ממוצע 3 האומדנים האחרונים: ${Math.round(avg3)} ${avg3 >= 134 ? '(מעל 134 באומדן הפנימי)' : `(${Math.max(1, Math.ceil(134 - avg3)) === 1 ? 'חסרה נקודה אחת' : `חסרות ${Math.ceil(134 - avg3)} נק׳`} ל-134 באומדן)`}` });
          reasons.push({ ok: spread <= 12, text: spread <= 12 ? `יציבות טובה (פער ${spread} נק׳ בין המבחנים)` : `תנודתיות גבוהה (פער ${spread} נק׳). עוד כמה סימולציות ייצבו את התמונה` });
          const weakTypes = Object.entries(typeAcc).filter(([, d]) => d.t > 0 && d.c / d.t < 0.7);
          reasons.push({ ok: weakTypes.length === 0, text: weakTypes.length === 0 ? 'כל סוגי השאלות מעל 70%' : `פחות מ-70% הצלחה: ${weakTypes.map(([t]) => TYPE_LABELS[t] ?? t).join(', ')}` });
          if (hiTotal > 0) reasons.push({ ok: hiCorrect / hiTotal >= 0.55, text: `ברמות 4-5: ${Math.round((hiCorrect / hiTotal) * 100)}% ${hiCorrect / hiTotal >= 0.55 ? '(יציב גם ברמות הגבוהות)' : '(כדאי לחזק את הרמות הגבוהות)'}` });
          if (timedQ > 0) reasons.push({ ok: overCap / timedQ <= 0.15, text: overCap === 0 ? 'קצב מצוין: אף שאלה לא חרגה מהתקציב' : `${heCount(overCap, 'question')} ${agree(overCap, 'חרגה', 'חרגו')} מתקציב הזמן` });
          const okCount = reasons.filter(r => r.ok).length;
          const verdict = okCount === reasons.length && rawRows.length >= 3 && avg3 >= 134
            ? { label: 'מוכנות גבוהה לפי מדדי האתר', cls: 'bg-exam-sage-strong text-on-emerald', desc: 'הביצועים יציבים והאומדן הפנימי מעל 134. זו אינה תחזית ציון רשמית.' }
            : avg3 >= 120 && rawRows.length >= 3
            ? { label: 'כמעט שם', cls: 'bg-exam-alt text-on-amber', desc: 'הבסיס חזק. עכשיו סגור את הפערים שמסומנים למטה.' }
            : { label: 'עוד לא, ממשיכים לעבוד', cls: 'bg-exam-paper-alt text-exam-ink', desc: 'תוכנית: סימולציית פרקי הליבה + תרגול חולשה ממוקד כל יום.' };
          return (
            <div className="bg-exam-surface rounded-2xl shadow-surface hover:shadow-raised transition-shadow duration-300 ease-spring border border-exam-border p-5 animate-fade-up">
              <div className="flex items-center gap-3 mb-1">
                <span className={`px-3 py-1 rounded-lg text-sm font-bold ${verdict.cls}`}>{verdict.label}</span>
                <h2 className="font-bold text-exam-ink text-sm">מדד מוכנות פנימי</h2>
              </div>
              <p className="text-xs text-exam-ink-soft mb-3">{verdict.desc}</p>
              <div className="space-y-1.5">
                {reasons.map((r, i) => (
                  <div key={i} className="flex items-start gap-2 text-sm">
                    <span className={r.ok ? 'text-exam-sage-strong' : 'text-exam-alt'}>{r.ok ? <Check className="w-3.5 h-3.5" strokeWidth={3} aria-hidden /> : '•'}</span>
                    <span className="text-exam-ink-soft">{r.text}</span>
                  </div>
                ))}
              </div>
            </div>
          );
        })()}

        {/* Summary cards */}
        <div className="grid grid-cols-3 gap-4">
          {[
            { label: 'מבחנים', value: stats.total_exams },
            { label: 'הציון הגבוה', value: stats.best_score ?? '—' },
            { label: 'ממוצע', value: stats.avg_score ? Math.round(stats.avg_score) : '—' },
          ].map((card, i) => (
            <div
              key={card.label}
              style={{ animationDelay: `${60 + i * 60}ms` }}
              className="bg-exam-surface rounded-2xl shadow-surface hover:shadow-raised hover:-translate-y-1 transition-[box-shadow,transform] duration-300 ease-spring will-change-transform border border-exam-border p-4 text-center animate-fade-up"
            >
              <div className="text-2xl font-bold text-exam-ink">{card.value}</div>
              <div className="text-xs text-exam-ink-soft mt-1">{card.label}</div>
            </div>
          ))}
        </div>

        {/* Best score classification */}
        {classification && stats.best_score && (
          <div className="bg-exam-surface rounded-2xl shadow-surface hover:shadow-raised transition-shadow duration-300 ease-spring border border-exam-border p-5 animate-fade-up [animation-delay:240ms]">
            <div className="text-sm text-exam-ink-soft mb-1">הציון הגבוה ביותר</div>
            <div className="text-4xl font-bold text-exam-ink">{stats.best_score}</div>
            <div className={`text-lg font-bold mt-1 ${classification.color}`}>
              {classification.label} — {classification.description}
            </div>
            <div className="text-[11px] text-exam-ink-soft mt-2">
              כל מוסד קובע בעצמו את הסף לפטור ולכל רמה. זה הטווח הנפוץ, לא תקן אחיד
            </div>
          </div>
        )}

        {/* 134+ goal tracker */}
        {(stats.score_history ?? []).length > 0 && (() => {
          const hist = (stats.score_history ?? []).map(h => h.score);
          const last = hist[hist.length - 1];
          const best = stats.best_score ?? last;
          const reached = best >= 134;
          const gap = Math.max(0, 134 - best);
          // Linear trend over the last (up to) 10 exams
          const recent = hist.slice(-10);
          let slope = 0;
          if (recent.length >= 2) {
            const n = recent.length;
            const xm = (n - 1) / 2;
            const ym = recent.reduce((a, b) => a + b, 0) / n;
            let num = 0, den = 0;
            recent.forEach((y, i) => { num += (i - xm) * (y - ym); den += (i - xm) * (i - xm); });
            slope = den > 0 ? num / den : 0;
          }
          const examsToGo = reached ? 0 : (slope >= 0.3 ? Math.max(1, Math.ceil((134 - last) / slope)) : null);
          const pct = Math.min(100, Math.max(0, ((best - 50) / 84) * 100));
          return (
            <div className="bg-exam-surface rounded-2xl shadow-surface hover:shadow-raised transition-shadow duration-300 ease-spring border border-exam-border p-5 animate-fade-up [animation-delay:300ms]">
              <div className="flex items-center justify-between mb-1">
                <h2 className="font-bold text-exam-ink flex items-center gap-2"><Target className="w-4 h-4" aria-hidden />הדרך ל-134+</h2>
                {reached && (
                  <span
                    className="text-xs font-bold bg-exam-sage-strong text-on-emerald px-2 py-0.5 rounded-lg inline-flex items-center gap-1 shadow-progress"
                    style={{ animation: 'check-pop 0.6s cubic-bezier(0.34, 1.56, 0.64, 1) both, ring-glow 2.2s ease-in-out 0.6s infinite' }}
                  ><PartyPopper className="w-3 h-3" aria-hidden />האומדן הגיע ל-134+</span>
                )}
              </div>
              <p className="text-xs text-exam-ink-soft mb-4">134 הוא סף פטור נפוץ; הנתונים כאן הם אומדן פנימי ולא ציון רשמי</p>
              {/* Progress to goal */}
              <div className="relative h-3 bg-exam-paper-alt rounded-full overflow-hidden mb-2">
                <div className={`absolute inset-y-0 right-0 rounded-full ${reached ? 'bg-exam-sage-strong' : 'bg-exam-accent'}`} style={{ width: `${pct}%` }} />
              </div>
              <div className="flex justify-between text-xs text-exam-ink-soft mb-4">
                <span>134</span>
                <span>הציון הטוב ביותר שלך: <span className="font-bold text-exam-ink">{best}</span></span>
                <span>50</span>
              </div>
              <div className="grid grid-cols-2 gap-3 text-center">
                <div className="bg-exam-paper-alt rounded-xl p-3">
                  <div className="text-2xl font-bold text-exam-ink">{reached ? <Check className="w-6 h-6 mx-auto" strokeWidth={3} aria-hidden /> : gap}</div>
                  <div className="text-xs text-exam-ink-soft mt-0.5">{reached ? 'עברת את היעד' : 'נקודות עד היעד'}</div>
                </div>
                <div className="bg-exam-paper-alt rounded-xl p-3">
                  {reached ? (
                    <>
                      <Trophy className="w-7 h-7 mx-auto text-exam-sage-strong" aria-hidden />
                      <div className="text-xs text-exam-ink-soft mt-0.5">שמור על הכושר עם תרגול</div>
                    </>
                  ) : examsToGo !== null ? (
                    <>
                      <div className="text-2xl font-bold text-exam-ink"><bdi dir="ltr">~{examsToGo}</bdi></div>
                      <div className="text-xs text-exam-ink-soft mt-0.5">{agree(examsToGo, 'מבחן', 'מבחנים')} עד היעד בקצב הנוכחי (+{slope.toFixed(1)} נק׳ למבחן)</div>
                    </>
                  ) : (
                    <>
                      <div className="text-2xl font-bold text-exam-ink-soft">—</div>
                      <div className="text-xs text-exam-ink-soft mt-0.5">{hist.length < 2 ? 'עוד מבחן אחד ונחשב מגמה' : 'המגמה עדיין לא עולה. התמקד בחולשות למטה'}</div>
                    </>
                  )}
                </div>
              </div>
            </div>
          );
        })()}

        {/* Victory Path — calendar-day-based projection to the 134+ target */}
        {rawRows.length > 0 && <VictoryPath sessions={rawRows} targetScore={134} />}

        {/* Performance by type */}
        {Object.keys(stats.performance_by_type ?? {}).length > 0 && (
          <div className="bg-exam-surface rounded-2xl shadow-surface hover:shadow-raised transition-shadow duration-300 ease-spring border border-exam-border p-5 animate-fade-up [animation-delay:360ms]">
            <h2 className="font-bold text-exam-ink mb-4">ביצועים לפי סוג שאלה</h2>
            <div className="space-y-3">
              {Object.entries(stats.performance_by_type ?? {}).filter(([, d]) => d.total > 0).map(([type, data]) => {
                const pct = Math.round((data.correct / data.total) * 100);
                return (
                  <div key={type}>
                    <div className="flex justify-between text-sm mb-1">
                      <span className="text-exam-ink">{TYPE_LABELS[type] ?? type}</span>
                      <span className="text-exam-ink-soft">{data.correct}/{data.total} ({pct}%)</span>
                    </div>
                    <div className="h-2 bg-exam-paper-alt rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full ${pct >= 75 ? 'bg-exam-sage-strong' : pct >= 50 ? 'bg-exam-alt' : 'bg-exam-wrong'}`}
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Weakness Analysis */}
        {weakness && Object.keys(weakness.byType).length > 0 && (
          <div className="bg-exam-surface rounded-2xl shadow-surface hover:shadow-raised transition-shadow duration-300 ease-spring border border-exam-border p-5 animate-fade-up [animation-delay:420ms]">
            <h2 className="font-bold text-exam-ink mb-1">ניתוח חולשות</h2>
            <p className="text-exam-ink-soft text-xs mb-4">על סמך 10 המבחנים האחרונים שלך</p>

            {/* One-tap targeted practice at the right level */}
            {weakestType && (() => {
              const lastScore = (stats.score_history ?? []).slice(-1)[0]?.score ?? 100;
              const level = routeNextDifficulty((lastScore - 100) / 20);
              return (
                <Link
                  href={`/practice?type=${weakestType.type}&difficulty=${level}`}
                  className="flex items-center justify-between gap-3 mb-4 p-4 bg-exam-accent rounded-xl shadow-surface hover:shadow-raised active:shadow-pressed hover:-translate-y-1 active:translate-y-0 active:scale-[0.98] transition-[box-shadow,transform] duration-300 ease-spring will-change-transform"
                >
                  <div>
                    <div className="text-exam-accent-ink font-bold text-sm flex items-center gap-1.5"><Target className="w-4 h-4" aria-hidden />תרגל את החולשה שלך עכשיו</div>
                    <div className="text-exam-accent-ink/80 text-xs mt-0.5">
                      {TYPE_LABELS[weakestType.type] ?? weakestType.type} ברמה {level}, שנבחרה לפי הביצועים שלך
                    </div>
                  </div>
                  <span className="text-exam-accent-ink text-xl">‹</span>
                </Link>
              );
            })()}

            {/* By question type */}
            <div className="space-y-3 mb-5">
              {Object.entries(weakness.byType).filter(([, d]) => d.total > 0).map(([type, data]) => {
                const pct = data.total > 0 ? Math.round((data.correct / data.total) * 100) : 0;
                const isWeakest = weakestType?.type === type;
                const barColor = pct >= 80 ? 'bg-exam-sage-strong' : pct >= 60 ? 'bg-exam-alt' : 'bg-exam-wrong';
                return (
                  <div
                    key={type}
                    className={`p-3 rounded-xl border shadow-surface hover:shadow-raised hover:-translate-y-0.5 transition-[box-shadow,transform] duration-300 ease-spring will-change-transform ${isWeakest ? 'bg-exam-wrong-bg border-exam-wrong/40' : 'bg-exam-paper-alt border-exam-border'}`}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium text-exam-ink">
                          {TYPE_LABELS[type] ?? type}
                        </span>
                        {isWeakest && (
                          <span className="text-xs text-exam-wrong font-semibold inline-flex items-center gap-1"><AlertTriangle className="w-3 h-3" aria-hidden />כאן כדאי להתמקד</span>
                        )}
                      </div>
                      <span className={`text-sm font-bold ${pct >= 80 ? 'text-exam-sage-strong' : pct >= 60 ? 'text-exam-alt' : 'text-exam-wrong'}`}>
                        {pct}%
                      </span>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="flex-1 h-2.5 bg-exam-paper rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all ${barColor}`}
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                      <span className="text-xs text-exam-ink-soft w-16 text-left flex-shrink-0">
                        {data.correct}/{data.total}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* By difficulty if available */}
            {Object.keys(weakness.byDifficulty).length > 0 && (
              <>
                <h3 className="font-semibold text-exam-ink text-sm mb-3">לפי רמת קושי</h3>
                <div className="grid grid-cols-3 gap-3">
                  {(['easy', 'medium', 'hard'] as const).map(diff => {
                    const data = weakness.byDifficulty[diff];
                    if (!data) return null;
                    const pct = data.total > 0 ? Math.round((data.correct / data.total) * 100) : 0;
                    const color = pct >= 80
                      ? 'text-exam-sage-strong bg-exam-sage-bg border-exam-sage/40'
                      : pct >= 60
                      ? 'text-exam-alt bg-exam-alt-bg border-exam-alt/40'
                      : 'text-exam-wrong bg-exam-wrong-bg border-exam-wrong/40';
                    return (
                      <div key={diff} className={`p-3 rounded-xl border text-center shadow-surface hover:shadow-raised hover:-translate-y-0.5 transition-[box-shadow,transform] duration-300 ease-spring will-change-transform ${color}`}>
                        <div className="text-xl font-bold">{pct}%</div>
                        <div className="text-xs font-semibold mt-0.5">{DIFFICULTY_LABELS[diff]}</div>
                        <div className="text-xs opacity-70 mt-0.5">{data.correct}/{data.total}</div>
                      </div>
                    );
                  })}
                </div>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
