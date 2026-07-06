'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase';
import { classifyScore, SECTION_CONFIGS, type SectionResult } from '@/types/exam';
import { BackNav } from '@/components/BackNav';

interface Stats {
  total_exams: number;
  best_score: number | null;
  avg_score: number | null;
  score_history: { date: string; score: number }[];
  performance_by_type: Record<string, { correct: number; total: number }>;
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
  const [weakness, setWeakness] = useState<WeaknessData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      // Works for both logged-in users and guests — stats are computed
      // directly from completed exam sessions, keyed by the same user_id
      // the exam APIs write (auth id or the localStorage guest UUID).
      const userKey = user?.id ?? localStorage.getItem('amiret_guest_id');
      if (!userKey) {
        setLoading(false);
        return;
      }

      supabase
        .from('exam_sessions')
        .select('score, completed_at, section_results')
        .eq('user_id', userKey)
        .eq('is_practice', false)
        .not('completed_at', 'is', null)
        .not('score', 'is', null)
        .order('completed_at', { ascending: true })
        .then(({ data: sessions }) => {
          const rows = (sessions ?? []) as { score: number; completed_at: string; section_results: unknown }[];

          if (rows.length === 0) {
            setStats({ total_exams: 0, best_score: null, avg_score: null, score_history: [], performance_by_type: {} });
            setLoading(false);
            return;
          }

          const scores = rows.map(r => r.score);
          const performanceByType: Record<string, { correct: number; total: number }> = {};
          const byType: Record<string, { correct: number; total: number }> = {};
          const byDifficulty: Record<string, { correct: number; total: number }> = {};
          const recent = rows.slice(-10);

          for (const row of rows) {
            for (const sr of ((row.section_results ?? []) as SectionResult[])) {
              const cfg = SECTION_CONFIGS[sr.sectionIndex - 1];
              const t = cfg?.type ?? sr.type;
              if (!t) continue;
              if (!performanceByType[t]) performanceByType[t] = { correct: 0, total: 0 };
              performanceByType[t].correct += sr.correctCount ?? 0;
              performanceByType[t].total += sr.totalCount ?? 0;
            }
          }

          for (const row of recent) {
            for (const sr of ((row.section_results ?? []) as SectionResult[])) {
              const cfg = SECTION_CONFIGS[sr.sectionIndex - 1];
              const t = cfg?.type ?? sr.type;
              if (t) {
                if (!byType[t]) byType[t] = { correct: 0, total: 0 };
                byType[t].correct += sr.correctCount ?? 0;
                byType[t].total += sr.totalCount ?? 0;
              }

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

          setStats({
            total_exams: rows.length,
            best_score: Math.max(...scores),
            avg_score: scores.reduce((a, b) => a + b, 0) / scores.length,
            score_history: rows.map(r => ({ date: r.completed_at, score: r.score })),
            performance_by_type: performanceByType,
          });
          setWeakness({ byType, byDifficulty });
          setLoading(false);
        });
    });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-900" dir="rtl">
        <BackNav backHref="/exam" backLabel="מבחן" />
        <div className="flex items-center justify-center h-[calc(100vh-3rem)] text-slate-400 dark:text-slate-500">טוען...</div>
      </div>
    );
  }

  if (!stats || stats.total_exams === 0) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-900" dir="rtl">
        <BackNav backHref="/exam" backLabel="מבחן" />
        <div className="flex flex-col items-center justify-center h-[calc(100vh-3rem)] text-center px-4">
          <div className="text-5xl mb-4">📊</div>
          <h1 className="text-2xl font-bold text-slate-800 dark:text-slate-100 mb-2">אין עדיין נתונים</h1>
          <p className="text-slate-500 dark:text-slate-400 mb-6">סיים לפחות מבחן אחד כדי לראות סטטיסטיקות</p>
          <a href="/exam" className="px-6 py-3 bg-blue-600 text-white rounded-xl font-semibold hover:bg-blue-700 transition-colors">
            התחל מבחן
          </a>
        </div>
      </div>
    );
  }

  const classification = stats.best_score ? classifyScore(stats.best_score) : null;

  // Find weakest type for the weakness analysis section
  const weakestType = weakness && Object.keys(weakness.byType).length > 0
    ? Object.entries(weakness.byType).reduce((worst, [type, data]) => {
        const pct = data.total > 0 ? data.correct / data.total : 1;
        const worstPct = worst.data.total > 0 ? worst.data.correct / worst.data.total : 1;
        return pct < worstPct ? { type, data } : worst;
      }, { type: Object.keys(weakness.byType)[0], data: Object.values(weakness.byType)[0] })
    : null;

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-900" dir="rtl">
      <BackNav backHref="/exam" backLabel="מבחן" />
      <div className="max-w-2xl mx-auto space-y-6 py-8 px-4">
        <h1 className="text-2xl font-black text-slate-900 dark:text-white">הסטטיסטיקה שלי</h1>

        {/* Summary cards */}
        <div className="grid grid-cols-3 gap-4">
          {[
            { label: 'מבחנים', value: stats.total_exams },
            { label: 'ציון מקסימלי', value: stats.best_score ?? '—' },
            { label: 'ממוצע', value: stats.avg_score ? Math.round(stats.avg_score) : '—' },
          ].map(card => (
            <div key={card.label} className="bg-white dark:bg-slate-800 rounded-2xl p-4 shadow-sm border border-slate-200 dark:border-slate-700 text-center">
              <div className="text-2xl font-black text-slate-900 dark:text-white">{card.value}</div>
              <div className="text-xs text-slate-500 dark:text-slate-400 mt-1">{card.label}</div>
            </div>
          ))}
        </div>

        {/* Best score classification */}
        {classification && stats.best_score && (
          <div className="bg-white dark:bg-slate-800 rounded-2xl p-5 shadow-sm border border-slate-200 dark:border-slate-700">
            <div className="text-sm text-slate-500 dark:text-slate-400 mb-1">ציון מקסימלי</div>
            <div className="text-4xl font-black text-slate-900 dark:text-white">{stats.best_score}</div>
            <div className={`text-lg font-bold mt-1 ${classification.color}`}>
              {classification.label} — {classification.description}
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
            <div className="bg-white dark:bg-slate-800 rounded-2xl p-5 shadow-sm border border-slate-200 dark:border-slate-700">
              <div className="flex items-center justify-between mb-1">
                <h2 className="font-bold text-slate-900 dark:text-white">🎯 הדרך ל-134+</h2>
                {reached && <span className="text-xs font-bold bg-green-500 text-white px-2 py-0.5 rounded-full">הגעת לפטור! 🎉</span>}
              </div>
              <p className="text-xs text-slate-400 dark:text-slate-500 mb-4">134 = פטור מלא מקורסי אנגלית</p>
              {/* Progress to goal */}
              <div className="relative h-3 bg-slate-100 dark:bg-slate-700 rounded-full overflow-hidden mb-2">
                <div className={`absolute inset-y-0 right-0 rounded-full ${reached ? 'bg-green-500' : 'bg-blue-500'}`} style={{ width: `${pct}%` }} />
              </div>
              <div className="flex justify-between text-xs text-slate-400 dark:text-slate-500 mb-4">
                <span>134</span>
                <span>הציון הטוב ביותר שלך: <span className="font-bold text-slate-700 dark:text-slate-200">{best}</span></span>
                <span>50</span>
              </div>
              <div className="grid grid-cols-2 gap-3 text-center">
                <div className="bg-slate-50 dark:bg-slate-700/50 rounded-xl p-3">
                  <div className="text-2xl font-black text-slate-900 dark:text-white">{reached ? '✓' : gap}</div>
                  <div className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">{reached ? 'עברת את היעד' : 'נקודות עד היעד'}</div>
                </div>
                <div className="bg-slate-50 dark:bg-slate-700/50 rounded-xl p-3">
                  {reached ? (
                    <>
                      <div className="text-2xl font-black text-green-600">🏆</div>
                      <div className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">שמור על הכושר עם תרגול</div>
                    </>
                  ) : examsToGo !== null ? (
                    <>
                      <div className="text-2xl font-black text-slate-900 dark:text-white">~{examsToGo}</div>
                      <div className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">מבחנים עד היעד בקצב הנוכחי (+{slope.toFixed(1)} נק׳ למבחן)</div>
                    </>
                  ) : (
                    <>
                      <div className="text-2xl font-black text-slate-400 dark:text-slate-500">—</div>
                      <div className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">{hist.length < 2 ? 'עוד מבחן אחד ונחשב מגמה' : 'המגמה עדיין לא עולה — התמקד בחולשות למטה'}</div>
                    </>
                  )}
                </div>
              </div>
            </div>
          );
        })()}

        {/* Score history */}
        {(stats.score_history ?? []).length > 0 && (
          <div className="bg-white dark:bg-slate-800 rounded-2xl p-5 shadow-sm border border-slate-200 dark:border-slate-700">
            <h2 className="font-bold text-slate-900 dark:text-white mb-4">היסטוריית ציונים</h2>
            <div className="relative flex items-end gap-2 h-24">
              {/* 134 target line */}
              <div className="absolute inset-x-0 border-t-2 border-dashed border-green-400/70 z-10 pointer-events-none" style={{ bottom: '84%' }}>
                <span className="absolute -top-2.5 left-0 text-[10px] font-bold text-green-500 bg-white dark:bg-slate-800 px-1 rounded">134</span>
              </div>
              {(stats.score_history ?? []).slice(-20).map((entry, i) => {
                const height = Math.max(8, ((entry.score - 50) / 100) * 100);
                const cls = classifyScore(entry.score);
                return (
                  <div key={i} className="flex-1 flex flex-col items-center gap-1">
                    <div
                      className={`w-full rounded-t transition-all ${
                        cls.label === 'פטור מלא' ? 'bg-green-500' :
                        cls.label.includes('מתקדמים') ? 'bg-blue-500' :
                        cls.label === 'בסיסי' ? 'bg-orange-500' : 'bg-red-500'
                      }`}
                      style={{ height: `${height}%` }}
                    />
                    <span className="text-xs text-slate-400 dark:text-slate-500 hidden sm:block">{entry.score}</span>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Performance by type */}
        {Object.keys(stats.performance_by_type ?? {}).length > 0 && (
          <div className="bg-white dark:bg-slate-800 rounded-2xl p-5 shadow-sm border border-slate-200 dark:border-slate-700">
            <h2 className="font-bold text-slate-900 dark:text-white mb-4">ביצועים לפי סוג שאלה</h2>
            <div className="space-y-3">
              {Object.entries(stats.performance_by_type ?? {}).filter(([, d]) => d.total > 0).map(([type, data]) => {
                const pct = Math.round((data.correct / data.total) * 100);
                return (
                  <div key={type}>
                    <div className="flex justify-between text-sm mb-1">
                      <span className="text-slate-700 dark:text-slate-200">{TYPE_LABELS[type] ?? type}</span>
                      <span className="text-slate-500 dark:text-slate-400">{data.correct}/{data.total} ({pct}%)</span>
                    </div>
                    <div className="h-2 bg-slate-100 dark:bg-slate-700 rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full ${pct >= 75 ? 'bg-green-500' : pct >= 50 ? 'bg-yellow-500' : 'bg-red-500'}`}
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
          <div className="bg-white dark:bg-slate-800 rounded-2xl p-5 shadow-sm border border-slate-200 dark:border-slate-700">
            <h2 className="font-bold text-slate-900 dark:text-white mb-1">ניתוח חולשות</h2>
            <p className="text-slate-400 dark:text-slate-500 text-xs mb-4">מבוסס על 10 המבחנים האחרונים שלך</p>

            {/* By question type */}
            <div className="space-y-3 mb-5">
              {Object.entries(weakness.byType).filter(([, d]) => d.total > 0).map(([type, data]) => {
                const pct = data.total > 0 ? Math.round((data.correct / data.total) * 100) : 0;
                const isWeakest = weakestType?.type === type;
                const barColor = pct >= 80 ? 'bg-green-500' : pct >= 60 ? 'bg-yellow-500' : 'bg-red-500';
                return (
                  <div
                    key={type}
                    className={`p-3 rounded-xl ${isWeakest ? 'bg-red-50 border border-red-200' : 'bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-700'}`}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium text-slate-800 dark:text-slate-100">
                          {TYPE_LABELS[type] ?? type}
                        </span>
                        {isWeakest && (
                          <span className="text-xs text-red-600 font-semibold">⚠️ כאן כדאי להתמרכז</span>
                        )}
                      </div>
                      <span className={`text-sm font-bold ${pct >= 80 ? 'text-green-600' : pct >= 60 ? 'text-yellow-600' : 'text-red-600'}`}>
                        {pct}%
                      </span>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="flex-1 h-2.5 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all ${barColor}`}
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                      <span className="text-xs text-slate-400 dark:text-slate-500 w-16 text-left flex-shrink-0">
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
                <h3 className="font-semibold text-slate-700 dark:text-slate-200 text-sm mb-3">לפי רמת קושי</h3>
                <div className="grid grid-cols-3 gap-3">
                  {(['easy', 'medium', 'hard'] as const).map(diff => {
                    const data = weakness.byDifficulty[diff];
                    if (!data) return null;
                    const pct = data.total > 0 ? Math.round((data.correct / data.total) * 100) : 0;
                    const color = pct >= 80
                      ? 'text-green-700 bg-green-50 border-green-200'
                      : pct >= 60
                      ? 'text-yellow-700 bg-yellow-50 border-yellow-200'
                      : 'text-red-700 bg-red-50 border-red-200';
                    return (
                      <div key={diff} className={`p-3 rounded-xl border text-center ${color}`}>
                        <div className="text-xl font-black">{pct}%</div>
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
