/**
 * The fetch the server's Supabase clients use, so a dead or hung database
 * fails in about a second instead of 5–7 s per API call.
 *
 * Where the time went: postgrest-js retries a read (GET) after a network
 * error 3 times, waiting 1 + 2 + 4 s, and supabase-js offers no option to
 * change that. Nothing bounded a request that hangs, either.
 *
 *  - Each attempt is cut off after DB_ATTEMPT_TIMEOUT_MS. postgrest-js never
 *    retries an AbortError, so a hung database costs one timeout, not four.
 *  - One retry is kept for a genuine blip. postgrest-js marks its retries
 *    with an X-Retry-Count header; a retry that also fails with a network
 *    error is re-thrown as an AbortError, which ends its retry loop.
 *    (src/lib/supabase-fetch.test.ts runs this against the real client, so
 *    a library change that breaks the trick fails the suite.)
 */

export const DB_ATTEMPT_TIMEOUT_MS = 10_000;
/** Retries allowed after a network error (postgrest-js alone does 3). */
export const DB_MAX_RETRIES = 1;

function isAbort(err: unknown): boolean {
  const e = err as { name?: string; code?: string } | null;
  return e?.name === 'AbortError' || e?.name === 'TimeoutError' || e?.code === 'ABORT_ERR';
}

export function boundedFetch(base: typeof fetch = fetch, timeoutMs = DB_ATTEMPT_TIMEOUT_MS): typeof fetch {
  return async (input, init = {}) => {
    const retry = Number(new Headers(init.headers).get('X-Retry-Count') ?? 0);
    const timeout = AbortSignal.timeout(timeoutMs);
    const signal = init.signal ? AbortSignal.any([init.signal, timeout]) : timeout;
    try {
      return await base(input, { ...init, signal });
    } catch (err) {
      if (isAbort(err) || retry < DB_MAX_RETRIES) throw err;
      const msg = err instanceof Error ? err.message : String(err);
      throw Object.assign(new Error(`${msg} (gave up after ${retry + 1} attempts)`, { cause: err }), { name: 'AbortError' });
    }
  };
}
