'use client';

import { useState } from 'react';
import { Check } from 'lucide-react';
import { authFetch } from '@/lib/auth-fetch';
import {
  ERROR_CAUSES, ERROR_CAUSE_LABEL, suggestCause, type ErrorCause, type TagTarget,
} from '@/lib/error-cause';

const RETRY_DELAY_MS = 1500;

async function sendTag(target: TagTarget, cause: ErrorCause | null): Promise<boolean> {
  const post = () => authFetch('/api/responses/tag', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ...target, cause }),
  });
  let res = await post();
  // 409: the fire-and-forget log for this answer may still be in flight.
  if (res.status === 409) {
    await new Promise(r => setTimeout(r, RETRY_DELAY_MS));
    res = await post();
  }
  return res.ok;
}

/**
 * "What happened here?" — one optional tap after a wrong answer. Never blocks
 * navigation; ignoring it is the skip. A latency-based suggestion gets a
 * dashed outline but is never pre-selected. After a pick only the chosen
 * chip remains; tapping it again reopens the choice.
 */
export function ErrorCauseTagger({
  target, questionType, latencyMs, initialCause = null,
}: {
  target: TagTarget;
  questionType: string;
  latencyMs?: number | null;
  initialCause?: ErrorCause | null;
}) {
  const [cause, setCause] = useState<ErrorCause | null>(initialCause);
  const [editing, setEditing] = useState(initialCause === null);
  const [failed, setFailed] = useState(false);
  const suggested = cause === null ? suggestCause(questionType, latencyMs) : null;

  const choose = async (next: ErrorCause) => {
    const previous = cause;
    setCause(next);
    setEditing(false);
    setFailed(false);
    const ok = await sendTag(target, next).catch(() => false);
    if (!ok) {
      setCause(previous);
      setEditing(true);
      setFailed(true);
    }
  };

  return (
    <div className="mt-3 rounded-xl border border-exam-border bg-exam-surface px-3 py-2.5" dir="rtl">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-xs font-bold text-exam-ink-soft ml-1">מה קרה כאן?</span>
        {editing ? (
          ERROR_CAUSES.map(c => (
            <button
              key={c}
              type="button"
              onClick={() => choose(c)}
              className={`hit-44 rounded-full px-3 py-1 text-xs font-semibold text-exam-ink transition-[background-color,border-color,transform] duration-300 ease-spring active:scale-[0.96] hover:bg-exam-paper-alt ${
                c === suggested ? 'border border-dashed border-exam-accent' : 'border border-exam-border'
              }`}
            >
              {ERROR_CAUSE_LABEL[c]}
            </button>
          ))
        ) : cause && (
          <button
            type="button"
            onClick={() => setEditing(true)}
            aria-label={`סיבה: ${ERROR_CAUSE_LABEL[cause]}. הקש לשינוי`}
            className="hit-44 inline-flex items-center gap-1.5 rounded-full border border-exam-accent bg-exam-accent px-3 py-1 text-xs font-bold text-exam-accent-ink animate-check-pop"
          >
            <Check className="w-3.5 h-3.5" strokeWidth={3} aria-hidden />
            {ERROR_CAUSE_LABEL[cause]}
          </button>
        )}
      </div>
      {failed && <p className="mt-1.5 text-[11px] text-exam-wrong">לא הצלחנו לשמור. נסה שוב.</p>}
    </div>
  );
}
