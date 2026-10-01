'use client';

import { useEffect, useState } from 'react';
import { AchievementGlow, RollingNumber, StreakShockwave, isStreakMilestone, useIncrease } from './AchievementMotion';
import { Flame } from 'lucide-react';
import { useDashboardSummary } from '@/lib/dashboard-context';
import { isEveningLocal } from '@/lib/date-local';

/** Matches the .rolling-digit-track animation, so the label never switches before the digit lands. */
const ROLL_MS = 360;

function streakLabel(streak: number) {
  return streak === 1 ? 'יום ברצף' : 'ימים ברצף';
}

export function StreakBadge() {
  const { data } = useDashboardSummary();
  const streak = data?.streak ?? 0;

  if (streak < 1) return null;

  const atRisk = data != null && !data.hasActivityToday && isEveningLocal();

  return <StreakDisplay streak={streak} atRisk={atRisk} />;
}

export function StreakDisplay({ streak, atRisk = false }: { streak: number; atRisk?: boolean }) {
  const motion = useIncrease(streak);
  const [labelFor, setLabelFor] = useState(streak);
  useEffect(() => {
    const timer = setTimeout(() => setLabelFor(streak), motion.increased ? ROLL_MS : 0);
    return () => clearTimeout(timer);
  }, [streak, motion.increased]);

  return (
    <div key={motion.revision} className={`${motion.increased ? 'achievement-pulse' : ''} relative isolate flex items-center gap-1.5 h-[34px] ps-3 pe-3.5 rounded-full border text-exam-alt transition-[background-color,border-color,box-shadow] duration-500 ease-spring-soft ${atRisk ? 'bg-transparent border-dashed border-exam-alt/45' : 'bg-exam-alt-bg border-exam-alt/20 shadow-[inset_0_1px_0_rgb(255_255_255/0.35)] dark:shadow-[inset_0_1px_0_rgb(255_255_255/0.06)]'}`}>
      {motion.increased && isStreakMilestone(streak) && <AchievementGlow key={motion.revision} tone="amber" />}
      <span className="inline-flex items-center gap-1.5">
        <span className="relative isolate inline-flex">
          {motion.increased && <StreakShockwave />}
          <Flame className="w-4 h-4 transition-[fill,color] duration-500 ease-spring-soft" fill={atRisk ? 'none' : 'currentColor'} aria-hidden />
        </span>
        <span className="text-[15px] font-extrabold tracking-[-0.01em] tabular-nums"><RollingNumber value={streak} from={motion.from} /></span>
      </span>
      <span className="text-xs font-medium text-exam-alt/85">{streakLabel(labelFor)}</span>
    </div>
  );
}
