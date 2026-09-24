'use client';

import { useState, type CSSProperties } from 'react';

/** Track actual value changes, not renders. Decreases/reset never celebrate. */
export function useIncrease(value: number) {
  const [motion, setMotion] = useState({ value, from: value, revision: 0 });
  if (motion.value !== value) {
    setMotion({ value, from: motion.value, revision: motion.revision + 1 });
  }
  return { ...motion, increased: motion.value > motion.from };
}

/** Fixed-width digit slots stay in LTR order inside the Hebrew interface. */
export function RollingNumber({ value, from = value }: { value: number; from?: number }) {
  const next = String(value);
  const previous = String(from).padStart(next.length, ' ');
  const roll = value > from;
  return (
    <span className="rolling-number" dir="ltr" aria-label={String(value)}>
      <span className="inline-flex" aria-hidden="true">
        {[...next].map((digit, i) => (
          <span className="rolling-digit" key={next.length - i}>
            {roll && previous[i] !== digit ? (
              <span key={`${from}-${value}`} className="rolling-digit-track" style={{ '--digit-delay': `${(next.length - i - 1) * 35}ms` } as CSSProperties}>
                <span>{previous[i]}</span><span>{digit}</span>
              </span>
            ) : <span>{digit}</span>}
          </span>
        ))}
      </span>
    </span>
  );
}

/** One soft pool of light: bounded to the component, never an endless loop. */
export function AchievementGlow({ tone = 'sage', delay = 0 }: { tone?: 'sage' | 'amber'; delay?: number }) {
  return <span aria-hidden="true" className={`achievement-glow achievement-glow-${tone}`} style={{ animationDelay: `${delay}ms` }} />;
}

export function isStreakMilestone(streak: number) {
  return streak === 7 || streak === 14 || streak === 30 || (streak > 30 && streak % 30 === 0);
}

/** A single impact flash and expanding ring, positioned behind the flame. */
export function StreakShockwave() {
  return <span className="streak-impact" aria-hidden="true"><span className="streak-impact-flash" /><span className="streak-impact-wave" /></span>;
}
