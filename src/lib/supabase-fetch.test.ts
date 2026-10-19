import { afterEach, describe, expect, it, vi } from 'vitest';
import { createClient } from '@supabase/supabase-js';
import { boundedFetch } from './supabase-fetch';

afterEach(() => vi.useRealTimers());

/** A database that refuses every connection, like the QA run's 127.0.0.1:9. */
function deadDb() {
  return vi.fn<typeof fetch>(() => Promise.reject(new TypeError('fetch failed', { cause: { code: 'ECONNREFUSED' } })));
}

async function readWith(fetchImpl: typeof fetch) {
  vi.useFakeTimers();
  const supabase = createClient('http://127.0.0.1:9', 'anon-key', {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { fetch: fetchImpl },
  });
  // The query builder only runs once awaited: start it, then let the
  // library's retry back-off (setTimeout) elapse.
  const pending = Promise.resolve(supabase.from('exam_sessions').select('id').eq('id', 'x'));
  await vi.runAllTimersAsync();
  return pending;
}

describe('boundedFetch with the real Supabase client', () => {
  it('gives up on a dead database after one retry (the library alone tries 4 times over 7 s)', async () => {
    const base = deadDb();
    const { data, error } = await readWith(boundedFetch(base));
    expect(base).toHaveBeenCalledTimes(2);
    expect(data).toBeNull();
    expect(error).not.toBeNull();
  });

  it('still recovers from a single blip', async () => {
    const base = vi.fn<typeof fetch>()
      .mockRejectedValueOnce(new TypeError('fetch failed'))
      .mockResolvedValueOnce(new Response('[{"id":"x"}]', { status: 200, headers: { 'Content-Type': 'application/json' } }));
    const { data, error } = await readWith(boundedFetch(base));
    expect(error).toBeNull();
    expect(data).toEqual([{ id: 'x' }]);
    expect(base).toHaveBeenCalledTimes(2);
  });
});

describe('boundedFetch', () => {
  it('cuts off an attempt that hangs', async () => {
    const hang = vi.fn<typeof fetch>((_input, init) => new Promise((_, reject) => {
      init?.signal?.addEventListener('abort', () => reject(init.signal!.reason));
    }));
    await expect(boundedFetch(hang, 20)('http://db.test')).rejects.toMatchObject({ name: 'TimeoutError' });
  });

  it('passes the first network error through, so the client may retry once', async () => {
    const err = new TypeError('fetch failed');
    await expect(boundedFetch(() => Promise.reject(err))('http://db.test')).rejects.toBe(err);
  });
});
