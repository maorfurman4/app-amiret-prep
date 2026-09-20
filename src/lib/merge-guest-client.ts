const VOCAB_KNOWN_KEY = 'vocab_known_ids';
const VOCAB_FAV_KEY = 'vocab_favorites';
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

export interface MergeGuestResult {
  ok: boolean;
  mergedExams?: number;
  mergedVocabKnown?: number;
  mergedVocabFavorites?: number;
}

/**
 * Moves guest-mode progress (exam history, review queue, streak, and
 * vocabulary known/favorite words) onto the account right after login or
 * signup. Callers must await this — a merge that silently fails means real
 * study progress (a streak, known/favorited words) is orphaned under the
 * guest cookie forever, since nothing else ever re-triggers it. Retries a
 * few times with backoff before giving up; the server route is idempotent,
 * so a retry (or a later manual re-trigger) is always safe to repeat.
 */
export async function mergeGuestProgress(accessToken: string): Promise<MergeGuestResult> {
  const body = JSON.stringify({
    vocabKnown: readLocalIds(VOCAB_KNOWN_KEY),
    vocabFavorites: readLocalIds(VOCAB_FAV_KEY),
  });

  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    try {
      const res = await fetch('/api/auth/merge-guest', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${accessToken}` },
        body,
        keepalive: true,
      });
      if (res.ok) {
        const data = await res.json().catch(() => ({})) as Omit<MergeGuestResult, 'ok'>;
        return { ok: true, ...data };
      }
    } catch {
      // network failure — fall through to retry
    }
    if (attempt < MAX_ATTEMPTS - 1) {
      await new Promise(r => setTimeout(r, RETRY_BASE_MS * 2 ** attempt));
    }
  }
  return { ok: false };
}
