'use client';

/**
 * Two concentric Apple-Fitness-style progress rings for the home page's
 * "Today" card. Hand-rolled SVG (stroke-dasharray/stroke-dashoffset) —
 * two circles don't need a charting library.
 *
 * Ring A ("תרגול היום"): activity units completed today vs. a personal
 * daily target. Ring B ("חזרה חכמה"): spaced-repetition items cleared
 * today vs. a target that's derived, not stored — clearedToday + stillDue,
 * so the ring is only ever "full" when nothing is left due right now.
 */
interface DailyRingsProps {
  activityUnitsToday: number;
  dailyActivityTarget: number;
  reviewClearedToday: number;
  reviewStillDue: number;
}

const SIZE = 72;
const STROKE = 7;
const R_OUTER = SIZE / 2 - STROKE / 2;
const R_INNER = R_OUTER - STROKE - 3;
const CIRC_OUTER = 2 * Math.PI * R_OUTER;
const CIRC_INNER = 2 * Math.PI * R_INNER;

function ringOffset(circumference: number, ratio: number): number {
  const clamped = Math.min(Math.max(ratio, 0), 1);
  return circumference * (1 - clamped);
}

export function DailyRings({ activityUnitsToday, dailyActivityTarget, reviewClearedToday, reviewStillDue }: DailyRingsProps) {
  const ringATarget = Math.max(dailyActivityTarget, 1);
  const ringARatio = activityUnitsToday / ringATarget;
  const ringBTarget = Math.max(reviewClearedToday + reviewStillDue, 1);
  const ringBRatio = reviewClearedToday / ringBTarget;

  return (
    <div className="flex items-center gap-3" dir="rtl">
      <svg width={SIZE} height={SIZE} viewBox={`0 0 ${SIZE} ${SIZE}`} className="-scale-x-100" aria-hidden>
        <circle cx={SIZE / 2} cy={SIZE / 2} r={R_OUTER} strokeWidth={STROKE} className="stroke-exam-border" fill="none" />
        <circle
          cx={SIZE / 2} cy={SIZE / 2} r={R_OUTER} strokeWidth={STROKE} fill="none"
          className="stroke-exam-accent transition-[stroke-dashoffset] duration-500"
          strokeLinecap="round"
          strokeDasharray={CIRC_OUTER}
          strokeDashoffset={ringOffset(CIRC_OUTER, ringARatio)}
          transform={`rotate(-90 ${SIZE / 2} ${SIZE / 2})`}
        />
        <circle cx={SIZE / 2} cy={SIZE / 2} r={R_INNER} strokeWidth={STROKE} className="stroke-exam-border" fill="none" />
        <circle
          cx={SIZE / 2} cy={SIZE / 2} r={R_INNER} strokeWidth={STROKE} fill="none"
          className="stroke-exam-sage transition-[stroke-dashoffset] duration-500"
          strokeLinecap="round"
          strokeDasharray={CIRC_INNER}
          strokeDashoffset={ringOffset(CIRC_INNER, ringBRatio)}
          transform={`rotate(-90 ${SIZE / 2} ${SIZE / 2})`}
        />
      </svg>
      <div className="flex flex-col gap-1 text-xs">
        <div className="flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full bg-exam-accent" aria-hidden />
          <span className="text-exam-ink-soft">תרגול היום</span>
          <span className="font-bold text-exam-ink tabular-nums">{activityUnitsToday}/{ringATarget}</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full bg-exam-sage" aria-hidden />
          <span className="text-exam-ink-soft">חזרה חכמה</span>
          <span className="font-bold text-exam-ink tabular-nums">{reviewClearedToday}/{ringBTarget}</span>
        </div>
      </div>
    </div>
  );
}
