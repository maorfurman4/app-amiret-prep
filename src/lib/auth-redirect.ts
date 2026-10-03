import { safeRedirectPath } from './safe-redirect';

export type AuthFlow = 'oauth' | 'signup' | 'recovery';

/**
 * Where Supabase sends the browser after Google sign-in or an email link.
 * Every flow goes through /auth/callback so the session is picked up, guest
 * progress is merged and the right screen follows. `flow` tells the callback
 * what the link was for — Supabase's error redirects (expired/used link)
 * carry no type of their own, so without it an expired sign-up link could
 * only be explained as an expired password reset.
 */
export function authCallbackUrl(origin: string, next: string, flow: AuthFlow): string {
  const params = new URLSearchParams({ next: safeRedirectPath(next), flow });
  return `${origin}/auth/callback?${params.toString()}`;
}

export function parseAuthFlow(value: string | null): AuthFlow {
  return value === 'signup' || value === 'recovery' ? value : 'oauth';
}
