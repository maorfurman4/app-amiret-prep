'use client';

import { Minus, Plus } from 'lucide-react';
import { MAX_DAILY_TARGET, MIN_DAILY_TARGET, stepTarget } from '@/lib/daily-goal';

/**
 * − value + for the daily goal, in steps of 5 within 5–50. Shared by the
 * account menu and the home prompt; `buttonClass` gives each its palette.
 */
export function GoalStepper({ value, onChange, labelledBy, buttonClass }: {
  value: number;
  onChange: (value: number) => void;
  labelledBy: string;
  buttonClass: string;
}) {
  const button = `grid size-8 place-items-center rounded-lg disabled:opacity-40 disabled:pointer-events-none transition-colors ${buttonClass}`;
  return (
    <div role="group" aria-labelledby={labelledBy} className="flex items-center gap-1.5">
      <button type="button" aria-label="פחות שאלות" disabled={value <= MIN_DAILY_TARGET} onClick={() => onChange(stepTarget(value, -1))} className={button}>
        <Minus className="w-4 h-4" aria-hidden />
      </button>
      <output aria-live="polite" className="min-w-[2.5ch] text-center text-base font-extrabold tabular-nums" data-goal-value>{value}</output>
      <button type="button" aria-label="יותר שאלות" disabled={value >= MAX_DAILY_TARGET} onClick={() => onChange(stepTarget(value, 1))} className={button}>
        <Plus className="w-4 h-4" aria-hidden />
      </button>
    </div>
  );
}
