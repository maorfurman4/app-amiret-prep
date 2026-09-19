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
  useEffect(() => { onExpireRef.current = onExpire; }, [onExpire]);

  const WARN_THRESHOLD = 10_000; // 10 seconds

  const computeRemaining = useCallback(() => {
    if (!expiresAt) return Infinity;
    return Math.max(0, new Date(expiresAt).getTime() - Date.now());
  }, [expiresAt]);

  useEffect(() => {
    if (isPractice || !expiresAt) return;

    const tick = () => {
      const ms = computeRemaining();
      setRemainingMs(ms);
      if (ms <= 0) {
        clearInterval(interval);
        onExpireRef.current();
      }
    };
    const interval = setInterval(tick, 500);
    const initialTick = setTimeout(tick, 0);

    return () => { clearInterval(interval); clearTimeout(initialTick); };
  }, [expiresAt, isPractice, computeRemaining]);

  if (remainingMs === null && !isPractice) {
    return <div className="w-24 h-10 rounded-sm border border-exam-border bg-exam-paper-alt animate-pulse" />;
  }

  if (isPractice) {
    return (
      <div className="flex items-center gap-2 px-3 py-1 rounded-sm border border-exam-border bg-exam-paper-alt text-exam-ink-soft text-sm font-medium">
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
    <div className={`flex flex-col items-center gap-1 px-4 py-2 rounded-sm border transition-colors ${
      isExpired ? 'bg-exam-wrong border-exam-wrong text-white' :
      isWarning  ? 'bg-exam-wrong-bg border-exam-wrong text-exam-wrong' :
                   'bg-exam-paper-alt border-exam-border text-exam-ink'
    }`}>
      {isWarning && !isExpired && (
        <div className="text-xs font-bold text-exam-wrong">
          ⚠ ענה מהר! הזמן עומד לפוג
        </div>
      )}
      <div className={`text-2xl font-semibold tabular-nums ${isWarning ? 'text-exam-wrong' : ''}`}>
        {String(minutes).padStart(2, '0')}:{String(secs).padStart(2, '0')}
      </div>
    </div>
  );
}
