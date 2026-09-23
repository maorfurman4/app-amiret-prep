import { describe, it, expect, vi, beforeEach } from 'vitest';

const authFetch = vi.hoisted(() => vi.fn());
vi.mock('@/lib/auth-fetch', () => ({ authFetch }));

import { DwellTimer, responseEntry, logResponses } from './response-log-client';
import { shuffleQuestionOptions } from './option-shuffle';
import type { Question } from '@/types/exam';

const q: Question = {
  id: '11111111-1111-4111-8111-111111111111',
  type: 'restatement',
  text: 't',
  options: [0, 1, 2, 3].map(i => ({ id: String(i), text: `opt${i}` })),
  correct_answer: 1,
  a: 1.2, b: 0, c: 0.25, difficulty_level: 3,
};

describe('DwellTimer', () => {
  it('measures a single visit', () => {
    const t = new DwellTimer();
    t.focus('a', 1_000);
    expect(t.elapsedMs('a', 4_500)).toBe(3_500);
  });

  it('sums time across revisits and excludes time spent elsewhere', () => {
    const t = new DwellTimer();
    t.focus('a', 0);
    t.focus('b', 2_000);   // a: 2s
    t.focus('a', 7_000);   // b: 5s
    t.focus(null, 8_000);  // a: +1s, then paused
    expect(t.elapsedMs('a', 60_000)).toBe(3_000);
    expect(t.elapsedMs('b', 60_000)).toBe(5_000);
  });

  it('refocusing the active item does not restart its clock', () => {
    const t = new DwellTimer();
    t.focus('a', 0);
    t.focus('a', 5_000);
    expect(t.elapsedMs('a', 6_000)).toBe(6_000);
  });

  it('reset clears everything', () => {
    const t = new DwellTimer();
    t.focus('a', 0);
    t.reset();
    expect(t.elapsedMs('a', 10_000)).toBe(0);
  });
});

describe('responseEntry', () => {
  it('logs the canonical option, not the shuffled display position', () => {
    const shown = shuffleQuestionOptions(q, () => 0); // deterministic non-identity order
    const displayIdx = shown.options.findIndex(o => o.text === 'opt3');
    const entry = responseEntry(shown, displayIdx, 'review', 1234.4);
    expect(entry).toMatchObject({ itemId: q.id, context: 'review', chosenOption: 3, latencyMs: 1234 });
  });

  it('keeps blanks as null and drops implausible latencies', () => {
    expect(responseEntry(q, null, 'practice', 500).chosenOption).toBeNull();
    expect(responseEntry(q, 0, 'practice', -5).latencyMs).toBeNull();
    expect(responseEntry(q, 0, 'practice', 3_600_001).latencyMs).toBeNull();
  });

  it('carries optional diagnostic context through', () => {
    expect(responseEntry(q, 0, 'diagnostic', 10, { thetaBefore: 0.4, sectionIndex: 2 }))
      .toMatchObject({ thetaBefore: 0.4, sectionIndex: 2 });
  });
});

describe('logResponses', () => {
  beforeEach(() => { authFetch.mockReset(); authFetch.mockResolvedValue(new Response('{}')); });

  it('batches into server-sized chunks and never throws', () => {
    authFetch.mockRejectedValue(new Error('offline'));
    const entries = Array.from({ length: 30 }, () => responseEntry(q, 0, 'practice', 100));
    expect(() => logResponses(entries)).not.toThrow();
    expect(authFetch).toHaveBeenCalledTimes(2);
    const sizes = authFetch.mock.calls.map(([, init]) => JSON.parse(init.body).responses.length);
    expect(sizes).toEqual([25, 5]);
    expect(authFetch.mock.calls[0][0]).toBe('/api/responses');
    expect(authFetch.mock.calls[0][1].keepalive).toBe(true);
  });
});
