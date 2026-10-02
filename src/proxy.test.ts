import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { issueGuestToken } from '@/lib/guest-token';

/**
 * Upstash is mocked with a real sliding count, so "healthy" tests exercise
 * the shared-limit path and `mode` switches it to an outage.
 */
const upstash = vi.hoisted(() => ({
  mode: 'ok' as 'ok' | 'throw' | 'timeout',
  counts: new Map<string, number>(),
}));

vi.mock('@upstash/redis/cloudflare', () => ({ Redis: class {} }));
vi.mock('@upstash/ratelimit', () => ({
  Ratelimit: class {
    static slidingWindow(max: number, window: string) { return { max, window }; }
    private max: number;
    private prefix: string;
    constructor(opts: { limiter: { max: number }; prefix: string }) {
      this.max = opts.limiter.max;
      this.prefix = opts.prefix;
    }
    async limit(key: string) {
      if (upstash.mode === 'throw') throw new Error('ERR max requests limit exceeded');
      if (upstash.mode === 'timeout') return { success: true, limit: 0, remaining: 0, reset: 0, reason: 'timeout' };
      const id = `${this.prefix}:${key}`;
      const n = (upstash.counts.get(id) ?? 0) + 1;
      upstash.counts.set(id, n);
      return { success: n <= this.max, limit: this.max, remaining: Math.max(0, this.max - n), reset: 0 };
    }
  },
}));

const SECRET = 'test-guest-secret';
process.env.KV_REST_API_URL = 'https://upstash.test';
process.env.KV_REST_API_TOKEN = 'token';
process.env.GUEST_SIGNING_SECRET = SECRET;

type Proxy = typeof import('./proxy');
let proxy: Proxy['proxy'];

beforeEach(async () => {
  upstash.mode = 'ok';
  upstash.counts.clear();
  vi.spyOn(console, 'error').mockImplementation(() => {});
  // Fresh module per test: the in-memory fallback state lives in it.
  vi.resetModules();
  ({ proxy } = await import('./proxy'));
});

function req(path: string, { method = 'GET', ip = '10.0.0.1', auth, guest }: {
  method?: string; ip?: string; auth?: string; guest?: string;
} = {}) {
  const headers: Record<string, string> = { 'x-forwarded-for': ip };
  if (auth) headers.authorization = `Bearer ${auth}`;
  if (guest) headers.cookie = `amiret_guest_v1=${guest}`;
  return new NextRequest(`https://app.test${path}`, { method, headers });
}

async function statuses(n: number, make: (i: number) => NextRequest): Promise<number[]> {
  const out: number[] = [];
  for (let i = 0; i < n; i++) out.push((await proxy(make(i))).status);
  return out;
}

const guestToken = () => issueGuestToken(SECRET).token;

describe('normal use is never blocked', () => {
  it('a guest doing an exam, practice, section mode and a diagnostic in one sitting', async () => {
    const guest = guestToken();
    const as = { guest };
    const flow: [string, string][] = [
      ['POST', '/api/auth/guest'],
      ['GET', '/api/dashboard-summary'],
      ['POST', '/api/exam/start'],
      ...Array.from({ length: 7 }, (): [string, string] => ['POST', '/api/exam/answer']),
      ...Array.from({ length: 7 }, (): [string, string] => ['GET', '/api/exam/state']),
      ['GET', '/api/exam/results'],
      ...Array.from({ length: 12 }, (): [string, string] => ['GET', '/api/practice/questions']),
      ...Array.from({ length: 40 }, (): [string, string] => ['POST', '/api/responses']),
      ...Array.from({ length: 15 }, (): [string, string] => ['POST', '/api/diagnostic/next']),
      ['GET', '/api/today-session'],
      ['GET', '/api/stats'],
    ];
    const codes = await statuses(flow.length, i => req(flow[i][1], { method: flow[i][0], ...as }));
    expect(codes.filter(c => c === 429)).toEqual([]);
  });

  it('a keen student starting 20 full exams in an hour', async () => {
    const codes = await statuses(20, () => req('/api/exam/start', { method: 'POST', auth: 'student-jwt' }));
    expect(codes).not.toContain(429);
  });

  it('a 40-seat lab behind one IP: every new device gets an identity and starts an exam', async () => {
    for (let seat = 0; seat < 40; seat++) {
      expect((await proxy(req('/api/auth/guest', { method: 'POST' }))).status).not.toBe(429);
      expect((await proxy(req('/api/exam/start', { method: 'POST', guest: guestToken() }))).status).not.toBe(429);
    }
  });

  it('section mode / practice are not under the exam-start cap', async () => {
    const codes = await statuses(100, () => req('/api/practice/questions', { auth: 'student-jwt' }));
    expect(codes).not.toContain(429);
  });

  it('returning guests (valid cookie) are never counted as new identities', async () => {
    const guest = guestToken();
    const codes = await statuses(100, () => req('/api/auth/guest', { method: 'POST', guest }));
    expect(codes).not.toContain(429);
  });
});

describe('abuse is bounded', () => {
  it('one identity hammering /api/exam/start is cut off after 20 per hour', async () => {
    const codes = await statuses(25, () => req('/api/exam/start', { method: 'POST', auth: 'attacker' }));
    expect(codes.slice(0, 20)).not.toContain(429);
    expect(codes.slice(20)).toEqual([429, 429, 429, 429, 429]);
  });

  it('rotating identities from one IP still caps exam starts at 120 per hour', async () => {
    const codes = await statuses(130, i => req('/api/exam/start', { method: 'POST', auth: `fake-${i}` }));
    expect(codes.slice(0, 120)).not.toContain(429);
    expect(codes.slice(120).every(c => c === 429)).toBe(true);
  });

  it('caps new guest identities per IP at 60 per hour', async () => {
    const codes = await statuses(65, () => req('/api/auth/guest', { method: 'POST' }));
    expect(codes.slice(0, 60)).not.toContain(429);
    expect(codes.slice(60).every(c => c === 429)).toBe(true);
  });

  it('a forged guest cookie does not dodge the identity cap', async () => {
    const forged = guestToken().replace(/.$/, c => (c === 'A' ? 'B' : 'A'));
    const codes = await statuses(65, () => req('/api/auth/guest', { method: 'POST', guest: forged }));
    expect(codes.slice(60).every(c => c === 429)).toBe(true);
  });

  it('caps question generation and official-score writes', async () => {
    const gen = await statuses(11, () => req('/api/questions/generate', { method: 'POST', auth: 'admin' }));
    expect(gen.at(-1)).toBe(429);
    const score = await statuses(11, () => req('/api/official-score', { method: 'PUT', auth: 'student' }));
    expect(score.at(-1)).toBe(429);
    // Reading your own scores is not a write — not under the tight cap.
    const reads = await statuses(30, () => req('/api/official-score', { auth: 'student' }));
    expect(reads).not.toContain(429);
  });
});

describe('a limiter outage does not switch limits off', () => {
  for (const mode of ['throw', 'timeout'] as const) {
    it(`Upstash ${mode}: exam/start is still capped (local fallback)`, async () => {
      upstash.mode = mode;
      const codes = await statuses(25, () => req('/api/exam/start', { method: 'POST', auth: 'attacker' }));
      expect(codes.slice(0, 20)).not.toContain(429);
      expect(codes.slice(20).every(c => c === 429)).toBe(true);
    });

    it(`Upstash ${mode}: guest minting is still capped`, async () => {
      upstash.mode = mode;
      const codes = await statuses(65, () => req('/api/auth/guest', { method: 'POST' }));
      expect(codes.slice(60).every(c => c === 429)).toBe(true);
    });

    it(`Upstash ${mode}: the general per-actor limit still applies`, async () => {
      upstash.mode = mode;
      const codes = await statuses(125, () => req('/api/stats', { auth: 'scraper' }));
      expect(codes.slice(0, 120)).not.toContain(429);
      expect(codes.slice(120).every(c => c === 429)).toBe(true);
    });

    it(`Upstash ${mode}: normal use keeps working, with no 500s`, async () => {
      upstash.mode = mode;
      const guest = guestToken();
      const codes = await statuses(30, i => req(i % 2 ? '/api/responses' : '/api/practice/questions', {
        method: i % 2 ? 'POST' : 'GET', guest,
      }));
      expect(codes.every(c => c !== 429 && c < 500)).toBe(true);
    });
  }
});

it('leaves non-API paths alone', async () => {
  upstash.mode = 'throw';
  expect((await proxy(req('/practice'))).status).toBe(200);
});
