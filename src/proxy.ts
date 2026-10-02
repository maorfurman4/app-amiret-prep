import { NextRequest, NextResponse } from 'next/server';
import { createHash } from 'node:crypto';
import { Ratelimit } from '@upstash/ratelimit';
// Fetch-only Redis client; works in the Node.js proxy runtime too.
import { Redis } from '@upstash/redis/cloudflare';
import { GUEST_COOKIE, guestSigningKey, verifyGuestToken } from '@/lib/guest-token';

/**
 * Rate limiting for API routes.
 *
 * Two layers on every /api/* request, both keyed off the caller's IP:
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
 * On top of those, ROUTE_RULES puts much tighter per-actor + per-IP limits
 * on the endpoints that are expensive to abuse: each call creates durable
 * rows (exam/start, a new guest identity) or spends money (question
 * generation). They target abuse, not use — /api/exam/start is only the
 * full exam (~50 min each); section mode and practice draw from
 * /api/practice/questions and are untouched.
 *
 * Uses Upstash Redis (shared, real limiting across all serverless instances)
 * when the Vercel-managed Upstash integration's env vars are present. Falls
 * back to an in-memory per-instance window when it isn't configured, AND
 * whenever Upstash errors or times out — a limiter outage degrades every
 * limit to per-instance rather than switching limiting off.
 *
 * Var names: Vercel's "Connect to Project" flow for the Upstash Redis
 * integration names these KV_REST_API_URL / KV_REST_API_TOKEN (a legacy
 * naming carried over from Vercel KV, not UPSTASH_REDIS_REST_URL/TOKEN as
 * the @upstash/redis docs' bare Upstash-account setup would suggest) — check
 * the actual Environment Variables list in the Vercel dashboard if this
 * integration is ever reconnected/renamed.
 */
const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const ACTOR_MAX_REQUESTS = 120; // generous: a full exam flow uses ~3 calls/section
const IP_MAX_REQUESTS = 600; // backstop for one IP minting many fake actors

/** Upstash's own default (5 s) resolves a slow call as *allowed*, and every
 * API request waits on it — give up sooner and use the local fallback. */
const UPSTASH_TIMEOUT_MS = 1_500;

interface Limit { max: number; windowMs: number }
interface RouteRule {
  name: string;
  /** Per IP + actor; omitted where the actor is the thing being created. */
  actor?: Limit;
  ip: Limit;
}

const ROUTE_RULES = {
  // Each call writes a ~29 KB exam_sessions row. A real student starts a
  // handful a day; a 40-seat lab behind one IP still fits the IP limit.
  examStart: { name: 'exam-start', actor: { max: 20, windowMs: HOUR }, ip: { max: 120, windowMs: HOUR } },
  // Only counted when a new identity would be minted (no valid cookie) —
  // returning guests are never limited here.
  guestMint: { name: 'guest-mint', ip: { max: 60, windowMs: HOUR } },
  // Admin-only, but each call is a paid OpenAI request.
  generate: { name: 'generate', actor: { max: 10, windowMs: HOUR }, ip: { max: 30, windowMs: HOUR } },
  // The route also has its own DB-backed 5 saves/min per account.
  officialScore: { name: 'official-score', actor: { max: 10, windowMs: MINUTE }, ip: { max: 60, windowMs: MINUTE } },
} satisfies Record<string, RouteRule>;

export function routeRule(req: NextRequest): RouteRule | null {
  const { pathname } = req.nextUrl;
  const method = req.method;
  if (pathname === '/api/exam/start' && method === 'POST') return ROUTE_RULES.examStart;
  if (pathname === '/api/questions/generate' && method === 'POST') return ROUTE_RULES.generate;
  if (pathname === '/api/official-score' && (method === 'PUT' || method === 'DELETE')) return ROUTE_RULES.officialScore;
  if (pathname === '/api/auth/guest' && method === 'POST'
    && !verifyGuestToken(req.cookies.get(GUEST_COOKIE)?.value, guestSigningKey())) {
    return ROUTE_RULES.guestMint;
  }
  return null;
}

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

function windowSpec(windowMs: number): `${number} s` {
  return `${windowMs / 1000} s`;
}

// One Upstash limiter per (prefix, limit), created on first use.
const limiters = new Map<string, Ratelimit>();
function upstashLimiter(prefix: string, { max, windowMs }: Limit): Ratelimit | null {
  if (!redis) return null;
  const id = `${prefix}:${max}:${windowMs}`;
  let limiter = limiters.get(id);
  if (!limiter) {
    limiter = new Ratelimit({
      redis,
      limiter: Ratelimit.slidingWindow(max, windowSpec(windowMs)),
      // Analytics writes extra Redis commands on every call — quota that a
      // busy day would burn through, which is exactly what makes Upstash
      // start failing.
      analytics: false,
      timeout: UPSTASH_TIMEOUT_MS,
      prefix,
    });
    limiters.set(id, limiter);
  }
  return limiter;
}

// In-memory fallback: used when Upstash isn't configured, errors, or times out
const hits = new Map<string, { windowMs: number; at: number[] }>();

function inMemoryLimit(key: string, { max, windowMs }: Limit): boolean {
  const now = Date.now();
  const entry = hits.get(key) ?? { windowMs, at: [] };
  entry.at = entry.at.filter(t => t > now - windowMs);
  entry.at.push(now);
  hits.set(key, entry);

  // Opportunistic cleanup so the map cannot grow unbounded — each entry
  // expires on its own window, so a minute-scale sweep never drops an
  // hour-scale count.
  if (hits.size > 5000) {
    for (const [k, v] of hits) {
      if (v.at[v.at.length - 1] <= now - v.windowMs) hits.delete(k);
    }
  }

  return entry.at.length <= max;
}

/**
 * Shared limit when Upstash answers; otherwise the same limit per instance.
 * Never "allow because the limiter is down": a transient Upstash error must
 * not take down every /api/* route (so no 500s), but it must not remove the
 * limits either.
 */
async function allow(prefix: string, key: string, limit: Limit): Promise<boolean> {
  const limiter = upstashLimiter(prefix, limit);
  if (limiter) {
    try {
      const res = await limiter.limit(key);
      if (res.reason !== 'timeout') return res.success;
      console.error(`rate limit check timed out (${prefix}), using local limit`);
    } catch (err) {
      console.error(`rate limit check failed (${prefix}), using local limit:`, err);
    }
  }
  return inMemoryLimit(`${prefix}:${key}`, limit);
}

export async function proxy(req: NextRequest) {
  if (!req.nextUrl.pathname.startsWith('/api/')) return NextResponse.next();

  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown';
  const actor = `${ip}:${actorKey(req)}`;
  const rule = routeRule(req);

  const checks = [
    allow('amiret-ratelimit-actor', actor, { max: ACTOR_MAX_REQUESTS, windowMs: MINUTE }),
    allow('amiret-ratelimit-ip', ip, { max: IP_MAX_REQUESTS, windowMs: MINUTE }),
  ];
  if (rule) {
    checks.push(allow(`amiret-ratelimit-${rule.name}-ip`, ip, rule.ip));
    if (rule.actor) checks.push(allow(`amiret-ratelimit-${rule.name}-actor`, actor, rule.actor));
  }

  if (!(await Promise.all(checks)).every(Boolean)) {
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
