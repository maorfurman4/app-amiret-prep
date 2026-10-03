import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { hasPendingGuestMerge, mergeGuestProgress, PENDING_MERGE_KEY } from './merge-guest-client';

function memoryStorage() {
  const map = new Map<string, string>();
  return {
    getItem: (k: string) => map.get(k) ?? null,
    setItem: (k: string, v: string) => { map.set(k, v); },
    removeItem: (k: string) => { map.delete(k); },
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
    const result = await mergeGuestProgress('token', fetcher);
    expect(result).toMatchObject({ ok: true, mergedExams: 0 });
    expect(fetcher).toHaveBeenCalledTimes(1);
    expect(hasPendingGuestMerge()).toBe(false);
  });

  it('does not retry a deliberate 4xx refusal, and leaves nothing pending', async () => {
    const fetcher = vi.fn().mockResolvedValue(json(400, { error: 'Invalid guestId' }));
    const result = await mergeGuestProgress('token', fetcher);
    expect(result).toEqual({ ok: false, retryable: false });
    expect(fetcher).toHaveBeenCalledTimes(1);
    expect(hasPendingGuestMerge()).toBe(false);
  });

  it('retries transient failures, then flags the merge for a quiet retry later', async () => {
    const fetcher = vi.fn()
      .mockRejectedValueOnce(new TypeError('Failed to fetch'))
      .mockResolvedValue(json(503));
    const pending = mergeGuestProgress('token', fetcher);
    await vi.runAllTimersAsync();
    expect(await pending).toEqual({ ok: false, retryable: true });
    expect(fetcher).toHaveBeenCalledTimes(3);
    expect(localStorage.getItem(PENDING_MERGE_KEY)).toBe('1');
  });

  it('clears the pending flag once a later attempt succeeds', async () => {
    localStorage.setItem(PENDING_MERGE_KEY, '1');
    const fetcher = vi.fn().mockResolvedValueOnce(json(500)).mockResolvedValue(json(200, { ok: true }));
    const pending = mergeGuestProgress('token', fetcher);
    await vi.runAllTimersAsync();
    expect((await pending).ok).toBe(true);
    expect(hasPendingGuestMerge()).toBe(false);
  });

  it('sends the locally-kept vocab lists and the bearer token', async () => {
    localStorage.setItem('vocab_known_ids', JSON.stringify(['a']));
    localStorage.setItem('vocab_favorites', JSON.stringify(['b']));
    const fetcher = vi.fn().mockResolvedValue(json(200, { ok: true }));
    await mergeGuestProgress('tok', fetcher);
    const [, init] = fetcher.mock.calls[0];
    expect(JSON.parse(init.body)).toEqual({ vocabKnown: ['a'], vocabFavorites: ['b'] });
    expect(init.headers.Authorization).toBe('Bearer tok');
  });
});
