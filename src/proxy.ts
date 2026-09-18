import { NextRequest, NextResponse } from 'next/server';
import { Ratelimit } from '@upstash/ratelimit';
// Fetch-only Redis client; works in the Node.js proxy runtime too.
import { Redis } from '@upstash/redis/cloudflare';

/**
 * Per-IP rate limiting for API routes.
 * Uses Upstash Redis (shared, real limiting across all serverless instances)
 * when the Vercel-managed Upstash integration's env vars are present. Falls
 * back to an in-memory per-instance window otherwise (best-effort only —
 * Vercel spreads requests across instances, so this fallback undercounts
 * under real load).
 *
 * Var names: Vercel's "Connect to Project" flow for the Upstash Redis
 * integration names these KV_REST_API_URL / KV_REST_API_TOKEN (a legacy
 * naming carried over from Vercel KV, not UPSTASH_REDIS_REST_URL/TOKEN as
 * the @upstash/redis docs' bare Upstash-account setup would suggest) — check
 * the actual Environment Variables list in the Vercel dashboard if this
 * integration is ever reconnected/renamed.
 */
const WINDOW_MS = 60_000;
const MAX_REQUESTS = 120; // generous: a full exam flow uses ~3 calls/section

const redis = process.env.KV_REST_API_URL && process.env.KV_REST_API_TOKEN
  ? new Redis({
      url: process.env.KV_REST_API_URL,
      token: process.env.KV_REST_API_TOKEN,
    })
  : null;

const ratelimit = redis
  ? new Ratelimit({
      redis,
      limiter: Ratelimit.slidingWindow(MAX_REQUESTS, '60 s'),
      analytics: true,
      prefix: 'amiret-ratelimit',
    })
  : null;

// In-memory fallback, only used when Upstash isn't configured
const hits = new Map<string, number[]>();

function inMemoryLimit(ip: string): boolean {
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

  return timestamps.length <= MAX_REQUESTS;
}

export async function proxy(req: NextRequest) {
  if (!req.nextUrl.pathname.startsWith('/api/')) return NextResponse.next();

  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown';

  const allowed = ratelimit
    ? (await ratelimit.limit(ip)).success
    : inMemoryLimit(ip);

  if (!allowed) {
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
