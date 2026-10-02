/**
 * Dev-only, in-browser stub for every network call the account popover makes,
 * so /dev/user-menu exercises the real UserMenu code paths (authFetch,
 * supabase.auth.updateUser / signOut, the user_stats read, /api/stats)
 * without any database. Nothing reaches Supabase: the dev env points it at a
 * dead port, and this intercepts before the request would even try.
 *
 * Scenarios via the query string:
 *   ?guest=1         no session (guest pill)
 *   ?stats=none      no completed exams
 *   ?stats=error     /api/stats fails
 *   ?fail=name|avatar|password   that write returns an error
 *   ?provider=google a Google user: user_metadata.avatar_url is the Google
 *                    photo, as every Google sign-in resets it to
 *   ?avatar=custom   user_stats.avatar_url already holds a custom upload
 *   ?live=1          the real auth subscription on the stub session (no
 *                    previewUser); window.__profileStub.refresh() runs a real
 *                    token refresh and remount() simulates a page change
 *
 * Every intercepted call is logged to window.__profileStub.calls.
 */

type Call = { method: string; path: string; body?: unknown };

export const STUB_USER_ID = '00000000-0000-4000-8000-000000000000';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? '';

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
}

// supabase-js keeps the session under sb-<first host label>-auth-token.
const storageKey = () => (SUPABASE_URL ? `sb-${new URL(SUPABASE_URL).hostname.split('.')[0]}-auth-token` : '');

const photo = (fill: string, label: string) =>
  `data:image/svg+xml,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><rect width="64" height="64" fill="${fill}"/><text x="32" y="42" font-size="28" font-family="sans-serif" font-weight="bold" fill="#fff" text-anchor="middle">${label}</text></svg>`)}`;
/** Stand-ins for the provider's photo and a custom upload, told apart at a glance. */
export const GOOGLE_PHOTO = photo('#4285f4', 'G');
export const CUSTOM_PHOTO = photo('#16a34a', 'C');

const isGoogle = () => typeof window !== 'undefined' && new URLSearchParams(window.location.search).get('provider') === 'google';

/** The user as auth hands it back on any sign-in or refresh. */
export function stubUser(google = isGoogle()) {
  return {
    id: STUB_USER_ID,
    aud: 'authenticated',
    role: 'authenticated',
    email: 'student@example.com',
    app_metadata: { provider: google ? 'google' : 'email' },
    user_metadata: google ? { full_name: 'נועה לוי', avatar_url: GOOGLE_PHOTO } : { full_name: 'נועה לוי' },
    created_at: '2026-01-01T00:00:00.000Z',
  };
}

const stubSession = () => ({
  access_token: 'stub-access-token', refresh_token: 'stub-refresh-token', token_type: 'bearer',
  expires_in: 3600, expires_at: Math.floor(Date.now() / 1000) + 3600, user: stubUser(),
});

/**
 * A far-from-expiry fake session: supabase-js serves it from storage without
 * a refresh, and updateUser/signOut send it to the stub below.
 */
export function writeStubSession() {
  try {
    localStorage.setItem(storageKey(), JSON.stringify(stubSession()));
  } catch { /* storage disabled */ }
}

/** Drops the fake session so it doesn't make other dev pages look signed in. */
export function removeStubSession() {
  try { localStorage.removeItem(storageKey()); } catch { /* storage disabled */ }
}

export function installProfileStub() {
  if (typeof window === 'undefined') return;
  const w = window as unknown as { __profileStub?: { calls: Call[]; state: Record<string, unknown> } };
  if (w.__profileStub) return;

  const params = new URLSearchParams(window.location.search);
  const guest = params.get('guest') === '1';
  const statsMode = params.get('stats') ?? 'some';
  const fail = params.get('fail');

  if (guest) removeStubSession();
  else writeStubSession();
  window.addEventListener('pagehide', removeStubSession);

  const state: Record<string, unknown> = {
    displayName: 'נועה Levi 2',
    avatarUrl: params.get('avatar') === 'custom' ? CUSTOM_PHOTO : null,
    passwordLength: 0,
  };
  const calls: Call[] = [];
  w.__profileStub = { calls, state };

  // Three completed real exams. Empty section_results: the header only reads
  // count / best / last, and computeStatsMetrics treats them as no answers.
  const rows = [98, 121, 113].map((score, i) => ({
    score,
    completed_at: new Date(Date.UTC(2026, 8, 20 + i * 3)).toISOString(),
    section_results: [],
    theta_final: null,
    theta_se: null,
    p_exempt: null,
  }));

  const realFetch = window.fetch.bind(window);
  window.fetch = async (input: RequestInfo | URL, init: RequestInit = {}) => {
    const url = new URL(typeof input === 'string' ? input : input instanceof URL ? input.href : input.url, window.location.href);
    const method = (init.method ?? (input instanceof Request ? input.method : 'GET')).toUpperCase();
    const path = url.origin === window.location.origin ? url.pathname : url.href.replace(SUPABASE_URL, '<supabase>');
    const log = (body?: unknown) => calls.push({ method, path, body });

    if (url.origin === window.location.origin) {
      if (url.pathname === '/api/stats') {
        log();
        await new Promise(r => setTimeout(r, 400)); // visible loading state
        if (statsMode === 'error') return json({ error: 'stub failure' }, 500);
        return json({ sessions: statsMode === 'none' ? [] : rows });
      }
      if (url.pathname === '/api/profile/update-name') {
        const body = JSON.parse(String(init.body ?? '{}')) as { displayName?: string };
        log(body);
        if (fail === 'name') return json({ error: 'השמירה נכשלה (stub)' }, 500);
        state.displayName = (body.displayName ?? '').trim().slice(0, 40);
        return json({ ok: true, displayName: state.displayName });
      }
      if (url.pathname === '/api/profile/upload-avatar') {
        if (method === 'DELETE') {
          log();
          if (fail === 'avatar') return json({ error: 'ההסרה נכשלה (stub)' }, 500);
          state.avatarUrl = null;
          return json({ ok: true });
        }
        const file = (init.body as FormData).get('file') as File;
        log({ name: file.name, type: file.type, size: file.size });
        if (fail === 'avatar') return json({ error: 'ההעלאה נכשלה (stub)' }, 500);
        state.avatarUrl = URL.createObjectURL(file);
        return json({ ok: true, avatarUrl: state.avatarUrl });
      }
      if (url.pathname === '/api/auth/guest') {
        log();
        return json({ ok: true, guestId: 'stub-guest' });
      }
      return realFetch(input, init);
    }

    if (SUPABASE_URL && url.href.startsWith(SUPABASE_URL)) {
      if (url.pathname === '/rest/v1/user_stats') {
        log();
        return json({ display_name: state.displayName, avatar_url: state.avatarUrl });
      }
      if (url.pathname === '/auth/v1/user' && method === 'PUT') {
        const body = JSON.parse(String(init.body ?? '{}')) as { password?: string };
        log({ passwordLength: body.password?.length ?? 0 });
        if (fail === 'password') return json({ code: 422, error_code: 'weak_password', msg: 'הסיסמה נדחתה (stub)' }, 422);
        state.passwordLength = body.password?.length ?? 0;
        return json(stubUser());
      }
      if (url.pathname === '/auth/v1/token') {
        log();
        return json(stubSession());
      }
      if (url.pathname === '/auth/v1/logout') {
        log();
        return new Response(null, { status: 204 });
      }
      log();
      return json({ error: 'not stubbed' }, 404);
    }

    return realFetch(input, init);
  };
}
