'use client';

import { useEffect, useState } from 'react';
import { DashboardSummaryProvider } from '@/lib/dashboard-context';
import { DailyGoalPrompt } from '@/components/home/DailyGoalPrompt';
import { GoalMetCelebration, GoalReward } from '@/components/home/GoalMetCelebration';
import { goalPromptKey } from '@/lib/daily-goal';
import { installProfileStub, removeStubSession, writeStubSession, STUB_USER_ID } from '../user-menu/stub';

// Before anything creates the Supabase client (see ../user-menu/stub.ts).
installProfileStub();
// The prompt asks once per account; the preview always asks.
try { localStorage.removeItem(goalPromptKey(STUB_USER_ID)); } catch { /* storage disabled */ }

const button = 'rounded-xl border border-exam-border bg-exam-surface px-4 py-3 text-exam-ink shadow-surface hover:shadow-raised active:scale-[.97] transition-[box-shadow,transform] duration-300 ease-spring';

/**
 * Dev-only: the daily-goal prompt and the goal-met celebration against the
 * in-browser stub. ?done=15&target=15 makes the real home trigger fire
 * (clear amiret_goal_celebration_seen_date to see it again).
 */
export function DailyGoalPreview() {
  const [reward, setReward] = useState(0);
  useEffect(() => {
    writeStubSession();
    return removeStubSession;
  }, []);
  return (
    <main className="mx-auto max-w-lg space-y-6 px-4 py-10 text-exam-ink" dir="rtl">
      <h1 className="text-xl font-bold">/dev/daily-goal</h1>
      <DashboardSummaryProvider>
        <GoalMetCelebration />
        <div className="empty:hidden"><DailyGoalPrompt /></div>
      </DashboardSummaryProvider>
      <div className="flex flex-wrap gap-3">
        <button className={button} onClick={() => setReward(n => n + 1)}>חגיגת יעד</button>
        <button className={button} onClick={() => document.documentElement.classList.toggle('dark')}>מצב בהיר / כהה</button>
      </div>
      {reward > 0 && <GoalReward key={reward} target={15} onDismiss={() => setReward(0)} />}
    </main>
  );
}
