import { createClient } from './supabase';
import { ensureGuestIdentity } from './guest';

/**
 * fetch() that attaches the Supabase access token as a Bearer header.
 * The session lives in localStorage (not cookies), so this is how server
 * routes learn who the logged-in user is; guests simply get no header.
 */
export async function authFetch(input: RequestInfo | URL, init: RequestInit = {}): Promise<Response> {
  const headers = new Headers(init.headers);
  let authenticated = headers.has('Authorization');
  const { data: { session }, error } = await createClient().auth.getSession();
  if (error) throw error;
  if (session?.access_token) {
    headers.set('Authorization', `Bearer ${session.access_token}`);
    authenticated = true;
  }
  if (!authenticated) await ensureGuestIdentity();
  return fetch(input, { ...init, headers, cache: 'no-store' });
}
