'use client';

import { AchievementGlow, RollingNumber, StreakShockwave, isStreakMilestone, useIncrease } from './AchievementMotion';
import { Flame } from 'lucide-react';
import { useDashboardSummary } from '@/lib/dashboard-context';
import { isEveningLocal } from '@/lib/date-local';

export function StreakBadge() {
  const { data } = useDashboardSummary();
  const streak = data?.streak ?? 0;

  if (streak < 1) return null;

  const atRisk = data != null && !data.hasActivityToday && isEveningLocal();

  return <StreakDisplay streak={streak} atRisk={atRisk} />;
}

export function StreakDisplay({ streak, atRisk = false }: { streak: number; atRisk?: boolean }) {
  const motion = useIncrease(streak);
  return (
    <div key={motion.revision} className={`${motion.increased ? 'achievement-pulse' : ''} relative isolate flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-exam-alt/40 transition-[background-color,border-color,box-shadow] duration-500 ease-spring-soft ${atRisk ? 'bg-transparent' : 'bg-exam-alt-bg'}`}>
      {motion.increased && isStreakMilestone(streak) && <AchievementGlow key={motion.revision} tone="amber" />}
      <span className="inline-flex items-center gap-1.5">
        <span className="relative isolate inline-flex">
          {motion.increased && <StreakShockwave />}
        <Flame className="w-4 h-4 text-exam-alt transition-[fill,color] duration-500 ease-spring-soft" fill={atRisk ? 'none' : 'currentColor'} aria-hidden />
        </span>
        <span className="text-sm font-bold text-exam-alt tabular-nums"><RollingNumber value={streak} from={motion.from} /></span>
      </span>
      <span className="text-xs text-exam-alt">{streak === 1 ? 'יום רצוף' : 'ימים רצופים'}</span>
    </div>
  );
}
