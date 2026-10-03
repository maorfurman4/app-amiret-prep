import { claimLocalListsFor } from './local-learning-data';

const VOCAB_KNOWN_KEY = 'vocab_known_ids';
const VOCAB_FAV_KEY = 'vocab_favorites';
// Set when a merge failed for a transient reason (offline, 5xx) so the next
// page load can quietly try again instead of the login screen blocking on it.
export const PENDING_MERGE_KEY = 'amiret_pending_guest_merge';
const MAX_ATTEMPTS = 3;
const RETRY_BASE_MS = 500;

function readLocalIds(key: string): string[] {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as string[]) : [];
  } catch {
    return [];
  }
}

function setPending(pending: boolean) {
  try {
    if (pending) localStorage.setItem(PENDING_MERGE_KEY, '1');
    else localStorage.removeItem(PENDING_MERGE_KEY);
  } catch { /* Storage may be disabled; the retry is best-effort. */ }
}

export function hasPendingGuestMerge(): boolean {
  try { return localStorage.getItem(PENDING_MERGE_KEY) === '1'; }
  catch { return false; }
}

export interface MergeGuestResult {
  ok: boolean;
  /** false when the server answered and retrying cannot change the outcome. */
  retryable?: boolean;
  mergedExams?: number;
  mergedVocabKnown?: number;
  mergedVocabFavorites?: number;
}

type Fetcher = typeof fetch;

/**
 * Moves guest-mode progress (exam history, review queue, streak, and
 * vocabulary known/favorite words) onto the account right after login or
 * signup. The local vocab lists are only sent when they are guest progress
 * or already this account's (src/lib/local-learning-data.ts). The server route is idempotent and answers 200 even when there is
 * no guest history at all, so a non-OK answer is a real problem:
 *   - network failure / 5xx → retried with backoff, then flagged so the next
 *     page load retries silently (the guest cookie and local lists survive
 *     a failed merge, so nothing is lost by deferring it);
 *   - 4xx → the server deliberately refused; retrying can't help.
 * Either way the caller must NOT block the signed-in user on this — the
 * login itself already succeeded.
 */
export async function mergeGuestProgress(accessToken: string, userId: string, fetcher: Fetcher = fetch): Promise<MergeGuestResult> {
  // Another account's leftover lists are wiped here, never sent; guest (or
  // unlabelled, pre-owner) lists now belong to this account — so a retry
  // that ends up running for someone else can't take them either.
  claimLocalListsFor(userId);
  const body = JSON.stringify({
    vocabKnown: readLocalIds(VOCAB_KNOWN_KEY),
    vocabFavorites: readLocalIds(VOCAB_FAV_KEY),
  });

  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    try {
      const res = await fetcher('/api/auth/merge-guest', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${accessToken}` },
        body,
        keepalive: true,
      });
      if (res.ok) {
        setPending(false);
        const data = await res.json().catch(() => ({})) as Omit<MergeGuestResult, 'ok'>;
        return { ok: true, ...data };
      }
      if (res.status < 500) {
        setPending(false);
        return { ok: false, retryable: false };
      }
    } catch {
      // network failure — fall through to retry
    }
    if (attempt < MAX_ATTEMPTS - 1) {
      await new Promise(r => setTimeout(r, RETRY_BASE_MS * 2 ** attempt));
    }
  }
  setPending(true);
  return { ok: false, retryable: true };
}
