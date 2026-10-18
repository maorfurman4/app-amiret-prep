/**
 * Outbox for vocabulary changes that didn't reach the account.
 *
 * A known/favorite change is saved on the device first and then written to
 * the account (with retries). When those retries fail, the banner says the
 * change was "saved on this device, not yet in the account" — but the next
 * load used to replace the device's lists with the account's rows, losing
 * it. Failed changes now wait here: they are re-sent before the account is
 * read, and whatever still can't be sent is applied on top of the account's
 * rows so the device keeps showing it.
 *
 * Only the latest change per word matters (marking a word known, then not,
 * leaves one pending "not"), and "clear all" supersedes every earlier change
 * of its kind. The outbox carries the account's id; another account's is
 * ignored (and sign-out wipes it — see LEARNING_KEYS).
 */

export const PENDING_SYNC_KEY = 'vocab_pending_sync';

export type PendingOp =
  | { kind: 'known'; op: 'upsert'; wordId: string; interval_days: number; next_review_at: string }
  | { kind: 'known' | 'fav'; op: 'delete'; wordId: string }
  | { kind: 'fav'; op: 'upsert'; wordId: string }
  | { kind: 'known' | 'fav'; op: 'clear' };

export interface VocabLists {
  known: Set<string>;
  schedule: Record<string, { interval_days: number; next_review_at: string }>;
  favorites: Set<string>;
}

/** Same word, or a "clear" of that kind. */
function supersedes(op: PendingOp, earlier: PendingOp): boolean {
  if (op.kind !== earlier.kind) return false;
  if (op.op === 'clear') return true;
  return earlier.op !== 'clear' && earlier.wordId === op.wordId;
}

/** Queues a failed change, dropping the earlier ones it replaces. */
export function addPending(ops: PendingOp[], op: PendingOp): PendingOp[] {
  return [...ops.filter(e => !supersedes(op, e)), op];
}

/**
 * A change that did reach the account: earlier failed changes it replaces
 * must not be re-sent later and undo it.
 */
export function settlePending(ops: PendingOp[], op: PendingOp): PendingOp[] {
  return ops.filter(e => !supersedes(op, e));
}

/** The account's lists with the not-yet-sent changes applied, in order. */
export function applyPending(lists: VocabLists, ops: PendingOp[]): VocabLists {
  const known = new Set(lists.known);
  const schedule = { ...lists.schedule };
  const favorites = new Set(lists.favorites);
  for (const op of ops) {
    if (op.kind === 'known') {
      if (op.op === 'clear') {
        known.clear();
        for (const k of Object.keys(schedule)) delete schedule[k];
      } else if (op.op === 'delete') {
        known.delete(op.wordId);
        delete schedule[op.wordId];
      } else {
        known.add(op.wordId);
        schedule[op.wordId] = { interval_days: op.interval_days, next_review_at: op.next_review_at };
      }
    } else if (op.op === 'clear') {
      favorites.clear();
    } else if (op.op === 'delete') {
      favorites.delete(op.wordId);
    } else {
      favorites.add(op.wordId);
    }
  }
  return { known, schedule, favorites };
}

type Store = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;

function defaultStore(): Store | null {
  try { return typeof localStorage === 'undefined' ? null : localStorage; } catch { return null; }
}

/** This account's pending changes ([] for none, another account's, or unreadable storage). */
export function readPending(userId: string, store: Store | null = defaultStore()): PendingOp[] {
  try {
    const raw = store?.getItem(PENDING_SYNC_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as { userId?: string; ops?: PendingOp[] };
    return parsed.userId === userId && Array.isArray(parsed.ops) ? parsed.ops : [];
  } catch { return []; }
}

export function writePending(userId: string, ops: PendingOp[], store: Store | null = defaultStore()): void {
  try {
    if (ops.length === 0) store?.removeItem(PENDING_SYNC_KEY);
    else store?.setItem(PENDING_SYNC_KEY, JSON.stringify({ userId, ops }));
  } catch { /* Storage disabled or full. */ }
}

/**
 * Sends one change made outside /vocabulary (the /today review) and records
 * the outcome in the outbox: settled when it reached the account, queued for
 * /vocabulary to re-send when it didn't — never silently dropped.
 */
export async function sendOrQueue(
  userId: string,
  op: PendingOp,
  write: () => PromiseLike<{ error: unknown }>,
  store: Store | null = defaultStore(),
): Promise<boolean> {
  let ok = false;
  try { ok = !(await write()).error; } catch { ok = false; }
  const pending = readPending(userId, store);
  writePending(userId, ok ? settlePending(pending, op) : addPending(pending, op), store);
  return ok;
}
