'use client';

import { useEffect, useState } from 'react';
import { Flame } from 'lucide-react';
import { useDashboardSummary } from '@/lib/dashboard-context';
import { todayLocalStr } from '@/lib/date-local';

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
    const today = todayLocalStr();
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
        className={`bg-exam-surface rounded-md border border-exam-border px-8 py-10 max-w-xs w-full text-center transition-all duration-200 ${closing ? 'scale-90 opacity-0' : 'animate-streak-pop'}`}
        onClick={e => e.stopPropagation()}
      >
        <Flame className="w-16 h-16 mx-auto mb-3 text-exam-alt animate-streak-flicker" fill="currentColor" aria-hidden />
        <div className="text-3xl font-bold text-exam-alt mb-1 tabular-nums">
          {streak} {streak === 1 ? 'יום רצוף' : 'ימים רצופים'}
        </div>
        <p className="text-exam-ink-soft text-sm mb-6">כל הכבוד! ממשיכים ככה</p>
        <button
          onClick={dismiss}
          className="w-full py-3 bg-exam-alt hover:opacity-90 text-on-amber rounded-sm font-bold transition-opacity"
        >
          המשך
        </button>
      </div>
    </div>
  );
}
