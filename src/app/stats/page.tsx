'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase';
import { authFetch } from '@/lib/auth-fetch';
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
  const supabase = createClient();
  const [rows, setRows] = useState<StatsRow[]>([]);
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
          setRows(d.sessions ?? []);
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

  return <StatsView metrics={computeStatsMetrics(rows)} rows={rows} />;
}
