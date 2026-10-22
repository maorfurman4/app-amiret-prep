'use client';

import { useEffect, useState } from 'react';
import { fetchStatsRows, fetchStatsActivity, type StatsActivity } from '@/lib/stats-client';
import { computeStatsMetrics, type StatsRow } from '@/lib/stats-metrics';
import { BackNav } from '@/components/BackNav';
import { StatsView } from '@/components/stats/StatsView';
import { AlertTriangle } from 'lucide-react';

/**
 * Four sections, top to bottom: where you are + the next step, the trend,
 * one performance-by-type view, official scores. Every number comes from
 * computeStatsMetrics (src/lib/stats-metrics.ts), computed once per load.
 */
export default function StatsPage() {
  const [rows, setRows] = useState<StatsRow[]>([]);
  const [activity, setActivity] = useState<StatsActivity | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [loadToken, setLoadToken] = useState(0);

  useEffect(() => {
    let cancelled = false;
    // Always asks the server, which knows the owner from the session or the
    // HttpOnly guest cookie. Gating on the localStorage guest id showed
    // "first exam" to a returning Safari guest whose storage was purged
    // (the cookie survives), and hung when storage was blocked. No identity
    // at all → the server answers [] → the same empty state.
    fetchStatsRows()
      .then(sessions => {
        if (cancelled) return;
        setRows(sessions);
        setLoading(false);
      })
      .catch(() => {
        if (cancelled) return;
        setError(true);
        setLoading(false);
      });
    // The practice/error-cause widgets are additive — their fetch never blocks
    // or fails the page; it just stays null until (and unless) it resolves.
    fetchStatsActivity().then(a => { if (!cancelled) setActivity(a); });
    return () => { cancelled = true; };
  }, [loadToken]);

  if (error) {
    return (
      <div className="min-h-dvh bg-exam-paper" dir="rtl">
        <BackNav backHref="/exam" backLabel="מבחן" />
        <main id="main" className="flex flex-col items-center justify-center h-[calc(100dvh-3rem)] text-center px-4">
          <AlertTriangle className="w-12 h-12 mx-auto mb-4 text-exam-wrong" strokeWidth={1.5} aria-hidden />
          <p className="text-exam-ink-soft mb-6">לא הצלחנו לטעון את הסטטיסטיקה. בדוק את החיבור ונסה שוב.</p>
          <button
            onClick={() => { setError(false); setLoading(true); setLoadToken(t => t + 1); }}
            className="px-6 py-3 bg-exam-accent text-exam-accent-ink rounded-2xl shadow-raised hover:shadow-overlay active:shadow-pressed hover:-translate-y-1 active:translate-y-0 active:scale-[0.98] font-semibold transition-[box-shadow,transform] duration-300 ease-spring will-change-transform"
          >
            נסה שוב
          </button>
        </main>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="min-h-dvh bg-exam-paper" dir="rtl">
        <BackNav backHref="/exam" backLabel="מבחן" />
        <main id="main" className="flex items-center justify-center h-[calc(100dvh-3rem)] text-exam-ink-soft">טוען...</main>
      </div>
    );
  }

  return <StatsView metrics={computeStatsMetrics(rows)} rows={rows} activity={activity} />;
}
