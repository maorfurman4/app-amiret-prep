import { NextRequest, NextResponse } from 'next/server';
import { createHash } from 'node:crypto';
import { Ratelimit } from '@upstash/ratelimit';
// Fetch-only Redis client; works in the Node.js proxy runtime too.
import { Redis } from '@upstash/redis/cloudflare';

/**
 * Rate limiting for API routes.
 *
 * Two layers, both keyed off the caller's IP:
 *  - Per-actor (IP + signed-in user / guest cookie): the real limit that
 *    matters day to day. Keying in the actor means a shared-IP network
 *    (school computer lab, office) doesn't have every student sharing one
 *    120-req/min budget — each device/session gets its own.
 *  - Per-IP-only, much higher ceiling: a coarse backstop against one IP
 *    spinning up many fake actors (minting new guest cookies) to dodge the
 *    per-actor limit entirely.
 * The actor discriminator doesn't need to be cryptographically verified —
 * it only has to separate legitimate concurrent users sharing an IP from
 * each other. Downstream routes independently verify the guest cookie's
 * signature / auth token before trusting either one for anything real.
 *
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
const ACTOR_MAX_REQUESTS = 120; // generous: a full exam flow uses ~3 calls/section
const IP_MAX_REQUESTS = 600; // backstop for one IP minting many fake actors

const GUEST_COOKIE = 'amiret_guest_v1';

function actorKey(req: NextRequest): string {
  const auth = req.headers.get('authorization');
  if (auth) return `auth:${createHash('sha256').update(auth).digest('base64url').slice(0, 24)}`;
  const guestCookie = req.cookies.get(GUEST_COOKIE)?.value;
  if (guestCookie) return `guest:${createHash('sha256').update(guestCookie).digest('base64url').slice(0, 24)}`;
  return 'anon';
}

const redis = process.env.KV_REST_API_URL && process.env.KV_REST_API_TOKEN
  ? new Redis({
      url: process.env.KV_REST_API_URL,
      token: process.env.KV_REST_API_TOKEN,
    })
  : null;

const actorRatelimit = redis
  ? new Ratelimit({
      redis,
      limiter: Ratelimit.slidingWindow(ACTOR_MAX_REQUESTS, '60 s'),
      analytics: true,
      prefix: 'amiret-ratelimit-actor',
    })
  : null;

const ipRatelimit = redis
  ? new Ratelimit({
      redis,
      limiter: Ratelimit.slidingWindow(IP_MAX_REQUESTS, '60 s'),
      analytics: true,
      prefix: 'amiret-ratelimit-ip',
    })
  : null;

// In-memory fallback, only used when Upstash isn't configured
const hits = new Map<string, number[]>();

function inMemoryLimit(key: string, max: number): boolean {
  const now = Date.now();
  const windowStart = now - WINDOW_MS;

  const timestamps = (hits.get(key) ?? []).filter(t => t > windowStart);
  timestamps.push(now);
  hits.set(key, timestamps);

  // Opportunistic cleanup so the map cannot grow unbounded
  if (hits.size > 5000) {
    for (const [k, v] of hits) {
      if (v[v.length - 1] < windowStart) hits.delete(k);
    }
  }

  return timestamps.length <= max;
}

export async function proxy(req: NextRequest) {
  if (!req.nextUrl.pathname.startsWith('/api/')) return NextResponse.next();

  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown';
  const actor = `${ip}:${actorKey(req)}`;

  // A transient Upstash error/timeout must not take down every /api/*
  // route with it (this middleware runs in front of all of them, including
  // login and guest-cookie issuance) — fail OPEN (treat as allowed) on a
  // rate-limiter failure rather than letting the rejection propagate and
  // 500 the request. The in-memory fallback below already handles the
  // "not configured" case; this handles the separate "configured but
  // erroring right now" case the same way: degrade, don't block everyone.
  const [actorAllowed, ipAllowed] = await Promise.all([
    actorRatelimit
      ? actorRatelimit.limit(actor).then(r => r.success).catch(err => {
          console.error('actor rate limit check failed, failing open:', err);
          return true;
        })
      : inMemoryLimit(actor, ACTOR_MAX_REQUESTS),
    ipRatelimit
      ? ipRatelimit.limit(ip).then(r => r.success).catch(err => {
          console.error('IP rate limit check failed, failing open:', err);
          return true;
        })
      : inMemoryLimit(`ip:${ip}`, IP_MAX_REQUESTS),
  ]);

  if (!actorAllowed || !ipAllowed) {
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
