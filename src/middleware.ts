import { NextRequest, NextResponse } from 'next/server';

/**
 * Lightweight per-IP rate limiting for API routes.
 * In-memory sliding window per serverless instance — not a hard guarantee,
 * but blocks bursts and naive scraping at zero infra cost.
 */
const WINDOW_MS = 60_000;
const MAX_REQUESTS = 120; // generous: a full exam flow uses ~3 calls/section

const hits = new Map<string, number[]>();

export function middleware(req: NextRequest) {
  if (!req.nextUrl.pathname.startsWith('/api/')) return NextResponse.next();

  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown';
  const now = Date.now();
  const windowStart = now - WINDOW_MS;

  const timestamps = (hits.get(ip) ?? []).filter(t => t > windowStart);
  timestamps.push(now);
  hits.set(ip, timestamps);

  // Opportunistic cleanup so the map cannot grow unbounded
  if (hits.size > 5000) {
    for (const [k, v] of hits) {
      if (v[v.length - 1] < windowStart) hits.delete(k);
    }
  }

  if (timestamps.length > MAX_REQUESTS) {
    return NextResponse.json(
      { error: 'Too many requests — try again in a minute' },
      { status: 429, headers: { 'Retry-After': '60' } },
    );
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/api/:path*'],
};
