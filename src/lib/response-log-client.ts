import { authFetch } from '@/lib/auth-fetch';
import { toCanonicalOption } from '@/lib/option-shuffle';
import type { Question } from '@/types/exam';

/**
 * Client half of the responses log (see POST /api/responses).
 *
 * Latency everywhere means the same thing as the exam's per-question
 * timings: total time the item was on screen before its final answer,
 * summed across every visit. DwellTimer tracks that per item id, so
 * free-navigation formats (section mode, the review picker) and one-shot
 * formats measure it identically.
 */
export class DwellTimer {
  private totals = new Map<string, number>();
  private activeId: string | null = null;
  private activeSince = 0;

  /** Starts timing `id` (stopping whatever was active); null pauses. */
  focus(id: string | null, now: number = Date.now()): void {
    if (id === this.activeId) return;
    this.flush(now);
    this.activeId = id;
    this.activeSince = now;
  }

  /** Total ms `id` has been on screen, including a still-running visit. */
  elapsedMs(id: string, now: number = Date.now()): number {
    const running = id === this.activeId ? Math.max(0, now - this.activeSince) : 0;
    return Math.round((this.totals.get(id) ?? 0) + running);
  }

  reset(): void {
    this.totals.clear();
    this.activeId = null;
    this.activeSince = 0;
  }

  private flush(now: number): void {
    if (this.activeId === null) return;
    const spent = Math.max(0, now - this.activeSince);
    this.totals.set(this.activeId, (this.totals.get(this.activeId) ?? 0) + spent);
  }
}

export type ClientResponseContext = 'practice' | 'review' | 'diagnostic';

export interface ResponseLogEntry {
  itemId: string;
  context: ClientResponseContext;
  chosenOption: number | null;
  latencyMs: number | null;
  confidence?: number | null;
  thetaBefore?: number | null;
  sectionIndex?: number | null;
}

/** Same bound the server enforces — longer means a tab left open. */
const MAX_LATENCY_MS = 3_600_000;
const MAX_BATCH = 25;

/**
 * Builds a log entry from a question as displayed. `displayIndex` is the
 * option position the student actually clicked; it is converted to the
 * stored order here so the log is independent of shuffling.
 */
export function responseEntry(
  question: Pick<Question, 'id' | 'options' | 'option_order'>,
  displayIndex: number | null,
  context: ClientResponseContext,
  latencyMs: number | null,
  extra: { thetaBefore?: number | null; sectionIndex?: number | null; confidence?: number | null } = {},
): ResponseLogEntry {
  return {
    itemId: question.id,
    context,
    chosenOption: toCanonicalOption(question, displayIndex),
    latencyMs: latencyMs !== null && latencyMs >= 0 && latencyMs <= MAX_LATENCY_MS ? Math.round(latencyMs) : null,
    ...extra,
  };
}

/**
 * Fire-and-forget: logging must never block or break the study flow.
 * `keepalive` lets the final batch of a session survive the navigation
 * that usually follows it.
 */
export function logResponses(entries: ResponseLogEntry[]): void {
  for (let i = 0; i < entries.length; i += MAX_BATCH) {
    authFetch('/api/responses', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ responses: entries.slice(i, i + MAX_BATCH) }),
      keepalive: true,
    }).catch(() => {});
  }
}
