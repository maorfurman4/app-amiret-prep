import { createClient } from './supabase';
import { ensureGuestIdentity } from './guest';

/**
 * Thrown by authFetch when a request that should have been authenticated
 * (this browser session held a real Supabase session a moment ago) suddenly
 * has none — e.g. an expired/revoked refresh token. getSession() reports
 * this as `{ session: null, error: null }`, not a throw, so without this
 * check the request would silently go out guest-style and get written
 * under the wrong identity instead of surfacing the failure.
 */
export class AuthSessionExpiredError extends Error {
  constructor() {
    super('Auth session expired — please sign in again.');
    this.name = 'AuthSessionExpiredError';
  }
}

// Lazily tracks whether THIS page load has ever actually held a signed-in
// session. Only ever flips false -> true; a later SIGNED_OUT is an explicit,
// visible sign-out (the UI already reflects it), not the silent-expiry case
// this guards against, so it deliberately does not flip back.
let hasBeenAuthenticated = false;
let subscribed = false;
function trackAuthState() {
  if (subscribed) return;
  subscribed = true;
  createClient().auth.onAuthStateChange((_event, session) => {
    if (session) hasBeenAuthenticated = true;
  });
}

/**
 * fetch() that attaches the Supabase access token as a Bearer header.
 * The session lives in localStorage (not cookies), so this is how server
 * routes learn who the logged-in user is; guests simply get no header.
 */
export async function authFetch(input: RequestInfo | URL, init: RequestInit = {}): Promise<Response> {
  trackAuthState();
  const headers = new Headers(init.headers);
  let authenticated = headers.has('Authorization');
  const { data: { session }, error } = await createClient().auth.getSession();
  if (error) throw error;
  if (session?.access_token) {
    headers.set('Authorization', `Bearer ${session.access_token}`);
    authenticated = true;
  }
  if (!authenticated) {
    if (hasBeenAuthenticated) throw new AuthSessionExpiredError();
    await ensureGuestIdentity();
  }
  return fetch(input, { ...init, headers, cache: 'no-store' });
}
