'use client';

import { useEffect, useRef, useState, useCallback } from 'react';

interface ExamTimerProps {
  expiresAt: string | null;      // ISO string from server
  isPractice: boolean;
  onExpire: () => void;          // called when timer hits 0
}

export function ExamTimer({ expiresAt, isPractice, onExpire }: ExamTimerProps) {
  const [remainingMs, setRemainingMs] = useState<number | null>(null);
  const onExpireRef = useRef(onExpire);
  onExpireRef.current = onExpire;

  const WARN_THRESHOLD = 10_000; // 10 seconds

  const computeRemaining = useCallback(() => {
    if (!expiresAt) return Infinity;
    return Math.max(0, new Date(expiresAt).getTime() - Date.now());
  }, [expiresAt]);

  useEffect(() => {
    if (isPractice || !expiresAt) return;

    setRemainingMs(computeRemaining());

    const interval = setInterval(() => {
      const ms = computeRemaining();
      setRemainingMs(ms);
      if (ms <= 0) {
        clearInterval(interval);
        onExpireRef.current();
      }
    }, 500);

    return () => clearInterval(interval);
  }, [expiresAt, isPractice, computeRemaining]);

  if (remainingMs === null && !isPractice) {
    return <div className="w-24 h-10 rounded-xl bg-slate-100 dark:bg-slate-700 animate-pulse" />;
  }

  if (isPractice) {
    return (
      <div className="flex items-center gap-2 px-3 py-1 rounded-full bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-300 text-sm font-medium">
        <span className="text-base">⏸</span>
        מוד תרגול
      </div>
    );
  }

  const ms = remainingMs ?? 0;
  const seconds = Math.ceil(ms / 1000);
  const minutes = Math.floor(seconds / 60);
  const secs = seconds % 60;
  const isWarning = ms <= WARN_THRESHOLD && ms > 0;
  const isExpired = ms === 0 && remainingMs !== null;

  return (
    <div className={`flex flex-col items-center gap-1 px-4 py-2 rounded-xl font-mono transition-all ${
      isExpired ? 'bg-red-600 text-white animate-pulse' :
      isWarning  ? 'bg-red-50 dark:bg-red-950/40 text-red-600 dark:text-red-400 border-2 border-red-500' :
                   'bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-200'
    }`}>
      {isWarning && !isExpired && (
        <div className="text-xs font-bold text-red-600 animate-bounce">
          ⚠ ענה מהר! הזמן עומד לפוג
        </div>
      )}
      <div className={`text-2xl font-bold tabular-nums ${isWarning ? 'text-red-600' : ''}`}>
        {String(minutes).padStart(2, '0')}:{String(secs).padStart(2, '0')}
      </div>
    </div>
  );
}
