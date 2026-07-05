import { createClient } from './supabase';

/**
 * fetch() that attaches the Supabase access token as a Bearer header.
 * The session lives in localStorage (not cookies), so this is how server
 * routes learn who the logged-in user is; guests simply get no header.
 */
export async function authFetch(input: RequestInfo | URL, init: RequestInit = {}): Promise<Response> {
  const headers: Record<string, string> = { ...(init.headers as Record<string, string> ?? {}) };
  try {
    const { data: { session } } = await createClient().auth.getSession();
    if (session?.access_token) headers['Authorization'] = `Bearer ${session.access_token}`;
  } catch { /* guest */ }
  return fetch(input, { ...init, headers });
}
