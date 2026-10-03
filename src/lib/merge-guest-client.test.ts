import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { hasPendingGuestMerge, mergeGuestProgress, PENDING_MERGE_KEY } from './merge-guest-client';
import { LOCAL_OWNER_KEY } from './local-learning-data';

function memoryStorage() {
  const map = new Map<string, string>();
  return {
    getItem: (k: string) => map.get(k) ?? null,
    setItem: (k: string, v: string) => { map.set(k, v); },
    removeItem: (k: string) => { map.delete(k); },
    key: (i: number) => [...map.keys()][i] ?? null,
    get length() { return map.size; },
  };
}

const json = (status: number, body: unknown = {}) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

describe('mergeGuestProgress', () => {
  beforeEach(() => {
    vi.stubGlobal('localStorage', memoryStorage());
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it('succeeds in one call when the server has nothing to merge', async () => {
    const fetcher = vi.fn().mockResolvedValue(json(200, { ok: true, guest: false, mergedExams: 0 }));
    const result = await mergeGuestProgress('token', 'user-1', fetcher);
    expect(result).toMatchObject({ ok: true, mergedExams: 0 });
    expect(fetcher).toHaveBeenCalledTimes(1);
    expect(hasPendingGuestMerge()).toBe(false);
  });

  it('does not retry a deliberate 4xx refusal, and leaves nothing pending', async () => {
    const fetcher = vi.fn().mockResolvedValue(json(400, { error: 'Invalid guestId' }));
    const result = await mergeGuestProgress('token', 'user-1', fetcher);
    expect(result).toEqual({ ok: false, retryable: false });
    expect(fetcher).toHaveBeenCalledTimes(1);
    expect(hasPendingGuestMerge()).toBe(false);
  });

  it('retries transient failures, then flags the merge for a quiet retry later', async () => {
    const fetcher = vi.fn()
      .mockRejectedValueOnce(new TypeError('Failed to fetch'))
      .mockResolvedValue(json(503));
    const pending = mergeGuestProgress('token', 'user-1', fetcher);
    await vi.runAllTimersAsync();
    expect(await pending).toEqual({ ok: false, retryable: true });
    expect(fetcher).toHaveBeenCalledTimes(3);
    expect(localStorage.getItem(PENDING_MERGE_KEY)).toBe('1');
  });

  it('clears the pending flag once a later attempt succeeds', async () => {
    localStorage.setItem(PENDING_MERGE_KEY, '1');
    const fetcher = vi.fn().mockResolvedValueOnce(json(500)).mockResolvedValue(json(200, { ok: true }));
    const pending = mergeGuestProgress('token', 'user-1', fetcher);
    await vi.runAllTimersAsync();
    expect((await pending).ok).toBe(true);
    expect(hasPendingGuestMerge()).toBe(false);
  });

  it('sends the locally-kept vocab lists and the bearer token', async () => {
    localStorage.setItem('vocab_known_ids', JSON.stringify(['a']));
    localStorage.setItem('vocab_favorites', JSON.stringify(['b']));
    const fetcher = vi.fn().mockResolvedValue(json(200, { ok: true }));
    await mergeGuestProgress('tok', 'user-1', fetcher);
    const [, init] = fetcher.mock.calls[0];
    expect(JSON.parse(init.body)).toEqual({ vocabKnown: ['a'], vocabFavorites: ['b'] });
    expect(init.headers.Authorization).toBe('Bearer tok');
  });

  describe('whose lists are sent (shared devices)', () => {
    const sentBody = (fetcher: ReturnType<typeof vi.fn>) => JSON.parse(fetcher.mock.calls[0][1].body);
    const seedLists = () => {
      localStorage.setItem('vocab_known_ids', JSON.stringify(['k1', 'k2']));
      localStorage.setItem('vocab_favorites', JSON.stringify(['f1']));
    };

    it('sends a guest\'s lists to the account they sign in to, and labels them as its own', async () => {
      seedLists();
      localStorage.setItem(LOCAL_OWNER_KEY, 'guest');
      const fetcher = vi.fn().mockResolvedValue(json(200, { ok: true }));
      await mergeGuestProgress('tok', 'user-B', fetcher);
      expect(sentBody(fetcher)).toEqual({ vocabKnown: ['k1', 'k2'], vocabFavorites: ['f1'] });
      expect(localStorage.getItem(LOCAL_OWNER_KEY)).toBe('user-B');
    });

    it('still sends unlabelled lists from before owners existed (a current guest loses nothing)', async () => {
      seedLists();
      const fetcher = vi.fn().mockResolvedValue(json(200, { ok: true }));
      await mergeGuestProgress('tok', 'user-B', fetcher);
      expect(sentBody(fetcher)).toEqual({ vocabKnown: ['k1', 'k2'], vocabFavorites: ['f1'] });
    });

    it('sends the account\'s own copy back to it (re-login on the same device)', async () => {
      seedLists();
      localStorage.setItem(LOCAL_OWNER_KEY, 'user-A');
      const fetcher = vi.fn().mockResolvedValue(json(200, { ok: true }));
      await mergeGuestProgress('tok', 'user-A', fetcher);
      expect(sentBody(fetcher)).toEqual({ vocabKnown: ['k1', 'k2'], vocabFavorites: ['f1'] });
    });

    it('never sends another account\'s lists, and wipes them from the device', async () => {
      seedLists();
      localStorage.setItem(LOCAL_OWNER_KEY, 'user-A');
      const fetcher = vi.fn().mockResolvedValue(json(200, { ok: true }));
      await mergeGuestProgress('tok', 'user-B', fetcher);
      expect(sentBody(fetcher)).toEqual({ vocabKnown: [], vocabFavorites: [] });
      expect(localStorage.getItem('vocab_known_ids')).toBeNull();
      expect(localStorage.getItem('vocab_favorites')).toBeNull();
      expect(localStorage.getItem(LOCAL_OWNER_KEY)).toBe('user-B');
    });

    it('a pending retry that runs for a different account sends nothing of the first one\'s', async () => {
      seedLists();
      // A's merge failed: the lists are claimed by A and flagged for retry…
      const failing = vi.fn().mockResolvedValue(json(503));
      const first = mergeGuestProgress('tokA', 'user-A', failing);
      await vi.runAllTimersAsync();
      await first;
      expect(hasPendingGuestMerge()).toBe(true);
      // …then A's session ends without the sign-out button and B signs in.
      const fetcher = vi.fn().mockResolvedValue(json(200, { ok: true }));
      await mergeGuestProgress('tokB', 'user-B', fetcher);
      expect(sentBody(fetcher)).toEqual({ vocabKnown: [], vocabFavorites: [] });
    });
  });
});
