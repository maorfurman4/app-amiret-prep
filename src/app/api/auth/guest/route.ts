import { NextRequest, NextResponse } from 'next/server';
import { GUEST_COOKIE, GUEST_MAX_AGE, guestSigningKey, issueGuestToken, verifyGuestToken } from '@/lib/guest-token';

// This endpoint sets/clears a credential; refuse cross-origin requests for both verbs.
function forbiddenCrossOrigin(req: NextRequest): boolean {
  const origin = req.headers.get('origin');
  return (!!origin && origin !== req.nextUrl.origin) || req.headers.get('sec-fetch-site') === 'cross-site';
}

export async function POST(req: NextRequest) {
  if (forbiddenCrossOrigin(req)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }
  const secret = guestSigningKey();
  if (!secret) return NextResponse.json({ error: 'Guest access unavailable' }, { status: 503 });
  const existing = verifyGuestToken(req.cookies.get(GUEST_COOKIE)?.value, secret);
  const identity = existing ? null : issueGuestToken(secret);
  const response = NextResponse.json({ guestId: existing ?? identity!.id }, {
    headers: { 'Cache-Control': 'private, no-store' },
  });
  if (identity) response.cookies.set(GUEST_COOKIE, identity.token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    path: '/',
    maxAge: GUEST_MAX_AGE,
  });
  return response;
}

/**
 * DELETE /api/auth/guest — clears the guest cookie. It's HttpOnly, so client
 * JS can't drop it directly; this is the only way to actually end a guest
 * identity, rather than leaving a still-valid, still-mergeable guest cookie
 * sitting in the browser. Called on sign-out, and internally by
 * /api/auth/merge-guest once a guest's data has been merged into an account
 * — otherwise a stale guest cookie on a shared device could be merged into
 * a second, unrelated account later.
 */
export async function DELETE(req: NextRequest) {
  if (forbiddenCrossOrigin(req)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }
  const response = NextResponse.json({ ok: true }, { headers: { 'Cache-Control': 'private, no-store' } });
  response.cookies.delete(GUEST_COOKIE);
  return response;
}
