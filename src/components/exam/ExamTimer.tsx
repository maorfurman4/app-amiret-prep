'use client';

import { AlertTriangle } from 'lucide-react';
import { useCountdown } from '@/lib/use-countdown';

interface ExamTimerProps {
  expiresAt: string | null;      // ISO string from server
  isPractice: boolean;
  onExpire: () => void;          // called when timer hits 0
  /** See useCountdown's clockSkewMs — estimated serverClock - clientClock, from comparing expiresAt's session load against the server's own reported time. */
  clockSkewMs?: number;
}

export function ExamTimer({ expiresAt, isPractice, onExpire, clockSkewMs }: ExamTimerProps) {
  const WARN_THRESHOLD = 10_000; // 10 seconds

  const deadline = expiresAt ? new Date(expiresAt).getTime() : null;
  const remainingMs = useCountdown({
    expiresAt: isPractice ? null : deadline,
    onExpire,
    intervalMs: 500,
    clockSkewMs,
  });

  if (remainingMs === null && !isPractice) {
    return <div className="w-24 h-10 rounded-sm border border-exam-border bg-exam-paper-alt animate-pulse" />;
  }

  if (isPractice) {
    return (
      <div className="flex items-center gap-2 px-3 py-1 rounded-sm border border-exam-border bg-exam-paper-alt text-exam-ink-soft text-sm font-medium">
        <span className="text-base">⏸</span>
        מצב תרגול
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
      isExpired ? 'bg-exam-wrong border-exam-wrong text-on-danger' :
      isWarning  ? 'bg-exam-wrong-bg border-exam-wrong text-exam-wrong' :
                   'bg-exam-paper-alt border-exam-border text-exam-ink'
    }`}>
      {isWarning && !isExpired && (
        <div className="text-xs font-bold text-exam-wrong flex items-center gap-1">
          <AlertTriangle className="w-3.5 h-3.5" aria-hidden />
          הזמן עומד להיגמר!
        </div>
      )}
      <div className={`text-2xl font-semibold tabular-nums ${isWarning ? 'text-exam-wrong' : ''}`}>
        {String(minutes).padStart(2, '0')}:{String(secs).padStart(2, '0')}
      </div>
    </div>
  );
}
