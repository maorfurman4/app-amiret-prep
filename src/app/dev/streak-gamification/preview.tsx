'use client';

import { useState } from 'react';
import { StreakDisplay } from '@/components/home/StreakBadge';
import { StreakReward } from '@/components/home/StreakCelebration';
import { DailyRings } from '@/components/home/DailyRings';
import type { Rings } from '@/lib/rings';

const initial: Rings = { effort: { done: 11, target: 15 }, retention: { done: 3, due: 1 }, simulation: { done: true } };
const button = 'rounded-xl border border-exam-border bg-exam-surface px-4 py-3 text-exam-ink shadow-surface hover:shadow-raised active:scale-[.97] transition-[box-shadow,transform] duration-300 ease-spring focus-visible:outline-2 focus-visible:outline-exam-accent';

export function GamificationPreview() {
  const [streak, setStreak] = useState(6);
  const [rings, setRings] = useState(initial);
  const [reward, setReward] = useState(0);
  const [hold, setHold] = useState(false);
  return (
    <main className="mx-auto max-w-xl space-y-8 px-6 py-24" dir="rtl">
      <header><h1 className="text-2xl font-bold text-exam-ink">רגע קטן של התקדמות</h1><p className="mt-2 text-exam-ink-soft">תצוגת תנועה מקומית · לא משנה נתוני למידה</p></header>
      <div className="flex justify-start"><StreakDisplay streak={streak} /></div>
      <section className="rounded-2xl border border-exam-border bg-exam-surface py-8 shadow-surface"><DailyRings rings={rings} persistCelebration={false} /></section>
      <div className="flex flex-wrap gap-3">
        <button className={button} onClick={() => setStreak(n => n + 1)}>הוספת יום</button>
        <button className={button} onClick={() => setStreak(9)}>הכנה ל־9 ← 10</button>
        <button className={button} onClick={() => setRings({ effort: { done: 15, target: 15 }, retention: { done: 4, due: 0 }, simulation: { done: true } })}>סגירת הטבעות</button>
        <button className={button} onClick={() => setReward(n => n + 1)}>חגיגת רצף</button>
        <button className={button} onClick={() => { setStreak(6); setRings(initial); setReward(0); }}>איפוס</button>
        <button className={button} onClick={() => document.documentElement.classList.toggle('dark')}>מצב בהיר / כהה</button>
      </div>
      <fieldset className="space-y-3"><legend className="font-bold text-exam-ink">התפתחות הלהבה</legend>
        <div className="flex flex-wrap gap-3">{[1, 7, 14, 30, 60].map(day => <button key={day} className={button} onClick={() => { setStreak(day); setReward(n => n + 1); }}>{day === 1 ? 'יום ראשון' : `${day} ימים`}</button>)}</div>
        <label className="flex items-center gap-2 text-exam-ink-soft"><input type="checkbox" checked={hold} onChange={e => setHold(e.target.checked)} />הצגת העיצוב ללא סגירה אוטומטית</label>
      </fieldset>
      {reward > 0 && <StreakReward key={reward} streak={streak} hold={hold} onDismiss={() => setReward(0)} />}
    </main>
  );
}
