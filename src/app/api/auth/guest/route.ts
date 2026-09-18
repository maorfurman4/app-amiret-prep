import { NextRequest, NextResponse } from 'next/server';
import { GUEST_COOKIE, GUEST_MAX_AGE, guestSigningKey, issueGuestToken, verifyGuestToken } from '@/lib/guest-token';

export async function POST(req: NextRequest) {
  // This endpoint sets a credential; refuse cross-origin requests.
  const origin = req.headers.get('origin');
  if ((origin && origin !== req.nextUrl.origin) || req.headers.get('sec-fetch-site') === 'cross-site') {
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
