'use client';

import { X } from 'lucide-react';

/**
 * "יציאה" for a run in progress (practice, /today, the diagnostic). On
 * desktop the bottom nav is hidden, so without it browser Back was the
 * only way out — and that dropped the run without asking.
 */
export function ExitRunButton({ onExit }: { onExit: () => void }) {
  return (
    <button
      type="button"
      onClick={onExit}
      className="hit-44 flex-shrink-0 inline-flex items-center gap-1 text-xs font-medium text-exam-ink-soft hover:text-exam-ink transition-colors"
    >
      <X className="w-4 h-4" aria-hidden />
      יציאה
    </button>
  );
}
