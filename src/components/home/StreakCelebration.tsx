'use client';

import { useEffect, useState } from 'react';
import { useDashboardSummary } from '@/lib/dashboard-context';

/** Same "today" definition as the server-side streak calc (lib/streak-server.ts). */
const TZ = 'Asia/Jerusalem';
function todayLocal(): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: TZ }).format(new Date());
}

const SEEN_KEY = 'amiret_streak_celebration_seen_date';

/**
 * Full-screen, once-a-day streak celebration (Duolingo-style) — a
 * centered card announcing the current streak, shown the first time the
 * home page loads on a given calendar day when a streak exists. Gated
 * via a localStorage date stamp so it doesn't reappear on every reload.
 * Auto-dismisses after a few seconds, or on tap/click anywhere.
 */
export function StreakCelebration() {
  const { data } = useDashboardSummary();
  const streak = data?.streak ?? 0;
  const [visible, setVisible] = useState(false);
  const [closing, setClosing] = useState(false);

  useEffect(() => {
    if (streak < 1) return;
    const today = todayLocal();
    try { if (localStorage.getItem(SEEN_KEY) === today) return; } catch { return; }
    const showTimer = setTimeout(() => {
      try { localStorage.setItem(SEEN_KEY, today); } catch { return; }
      setVisible(true);
    }, 300);
    return () => clearTimeout(showTimer);
  }, [streak]);

  const dismiss = () => {
    setClosing(true);
    setTimeout(() => { setVisible(false); setClosing(false); }, 200);
  };

  useEffect(() => {
    if (!visible) return;
    const t = setTimeout(dismiss, 3000);
    return () => clearTimeout(t);

  }, [visible]);

  if (!visible) return null;

  return (
    <div
      className={`fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-6 transition-opacity duration-200 ${closing ? 'opacity-0' : 'opacity-100'}`}
      onClick={dismiss}
      dir="rtl"
    >
      <div
        className={`bg-white dark:bg-slate-800 rounded-3xl px-8 py-10 max-w-xs w-full text-center shadow-2xl transition-all duration-200 ${closing ? 'scale-90 opacity-0' : 'animate-streak-pop'}`}
        onClick={e => e.stopPropagation()}
      >
        <div className="text-7xl mb-3 animate-streak-flicker">🔥</div>
        <div className="text-3xl font-black text-orange-600 dark:text-orange-400 mb-1 tabular-nums">
          {streak} {streak === 1 ? 'יום רצוף' : 'ימים רצופים'}
        </div>
        <p className="text-slate-500 dark:text-slate-400 text-sm mb-6">כל הכבוד! ממשיכים ככה 💪</p>
        <button
          onClick={dismiss}
          className="w-full py-3 bg-orange-500 hover:bg-orange-600 text-white rounded-xl font-bold transition-colors"
        >
          המשך
        </button>
      </div>
    </div>
  );
}
