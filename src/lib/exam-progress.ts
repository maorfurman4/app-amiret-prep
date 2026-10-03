/**
 * Client half of /api/exam/progress: keeps the server's copy of the current
 * section's answers up to date while the student works, so the answers
 * chosen in time survive a locked phone or a switch to another app (the
 * page is frozen then, and its auto-submit arrives after the deadline).
 *
 * One save per section at a time, newest answers win:
 *  - a pick sends right away; picks made while a save is in flight are
 *    coalesced into one follow-up save of the latest answers;
 *  - never two saves in flight, so an older save can't land after a newer
 *    one and overwrite it;
 *  - a failed save is retried with backoff; `flush()` (page hidden) retries
 *    at once — the last chance before the phone freezes the page;
 *  - once the server refuses (the deadline passed, the section moved on),
 *    the saver stops: nothing it sends could count any more.
 */
export type Answers = (number | null)[];
export type SaveResult = 'ok' | 'rejected' | 'failed';

export interface ProgressSaverOptions {
  /** Sends one save; resolves how it went. Should use fetch keepalive. */
  send: (answers: Answers) => Promise<SaveResult>;
  retryBaseMs?: number;
  retryMaxMs?: number;
  setTimer?: (fn: () => void, ms: number) => unknown;
  clearTimer?: (handle: unknown) => void;
}

export class ExamProgressSaver {
  private latest: Answers | null = null;
  private savedKey: string | null = null;
  private inFlight = false;
  private stopped = false;
  private retryHandle: unknown = null;
  private retryDelay: number;
  private readonly send: ProgressSaverOptions['send'];
  private readonly retryBaseMs: number;
  private readonly retryMaxMs: number;
  private readonly setTimer: NonNullable<ProgressSaverOptions['setTimer']>;
  private readonly clearTimer: NonNullable<ProgressSaverOptions['clearTimer']>;

  constructor({ send, retryBaseMs = 2_000, retryMaxMs = 15_000, setTimer, clearTimer }: ProgressSaverOptions) {
    this.send = send;
    this.retryBaseMs = retryBaseMs;
    this.retryMaxMs = retryMaxMs;
    this.retryDelay = retryBaseMs;
    this.setTimer = setTimer ?? ((fn, ms) => setTimeout(fn, ms));
    this.clearTimer = clearTimer ?? (handle => clearTimeout(handle as ReturnType<typeof setTimeout>));
  }

  /** The student's answers changed. */
  save(answers: Answers): void {
    this.latest = [...answers];
    void this.pump();
  }

  /** Page hidden: push any unsaved answers now instead of waiting for a retry. */
  flush(): void {
    this.cancelRetry();
    void this.pump();
  }

  /** The section is over (submitted or abandoned): send nothing more. */
  stop(): void {
    this.stopped = true;
    this.cancelRetry();
  }

  /** True while answers exist that the server hasn't confirmed. */
  get hasUnsaved(): boolean {
    return this.latest !== null && JSON.stringify(this.latest) !== this.savedKey;
  }

  private cancelRetry(): void {
    if (this.retryHandle !== null) {
      this.clearTimer(this.retryHandle);
      this.retryHandle = null;
    }
  }

  private async pump(): Promise<void> {
    if (this.inFlight || this.stopped || this.latest === null) return;
    const payload = this.latest;
    const key = JSON.stringify(payload);
    if (key === this.savedKey) return;

    this.inFlight = true;
    let result: SaveResult;
    try { result = await this.send(payload); } catch { result = 'failed'; }
    this.inFlight = false;

    if (this.stopped) return;
    if (result === 'rejected') { this.stop(); return; }
    if (result === 'failed') {
      this.cancelRetry();
      this.retryHandle = this.setTimer(() => { this.retryHandle = null; void this.pump(); }, this.retryDelay);
      this.retryDelay = Math.min(this.retryMaxMs, this.retryDelay * 2);
      return;
    }
    this.savedKey = key;
    this.retryDelay = this.retryBaseMs;
    // Picks made while this one was in flight.
    void this.pump();
  }
}

/** How a /api/exam/progress response maps onto the saver's outcomes. */
export function saveResultFromStatus(status: number): SaveResult {
  if (status >= 200 && status < 300) return 'ok';
  // 429 and 5xx are transient; any other 4xx is a final "no".
  if (status === 429 || status >= 500) return 'failed';
  return 'rejected';
}

/**
 * The previous section reached the server after its time was up — usually
 * because the phone was locked or another app was open. Answers saved
 * before the deadline counted; say how many didn't, if any.
 */
export function lateNoticeText(notCounted: number): string {
  const base = 'הזמן של הפרק הקודם נגמר לפני שהוא נשלח, למשל כשהמסך ננעל או כשעברת לאפליקציה אחרת. התשובות שסימנת לפני שהזמן נגמר נשמרו ונספרו.';
  if (notCounted <= 0) return base;
  return `${base} ${notCounted === 1 ? 'תשובה אחת לא הגיעה' : `${notCounted} תשובות לא הגיעו`} אלינו לפני סוף הזמן, ולכן לא ${notCounted === 1 ? 'נספרה' : 'נספרו'}.`;
}
