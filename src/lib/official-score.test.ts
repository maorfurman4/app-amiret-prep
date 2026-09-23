import { describe, it, expect, vi } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';
import { shouldPromptForScore, predictionBefore, PROMPT_MAX_DAYS } from './official-score';
import { currentEstimate } from './exemption';
import { thetaToScore } from './adaptive';

describe('shouldPromptForScore', () => {
  const base = { examDate: '2026-09-20', today: '2026-09-23', reported: false, dismissedFor: null };
  it('asks from the day after the exam', () => {
    expect(shouldPromptForScore(base)).toBe(true);
    expect(shouldPromptForScore({ ...base, today: '2026-09-21' })).toBe(true);
    expect(shouldPromptForScore({ ...base, today: '2026-09-20' })).toBe(false); // exam day itself
    expect(shouldPromptForScore({ ...base, today: '2026-09-10' })).toBe(false); // upcoming
  });
  it('never asks twice for a reported or declined sitting, or with no date', () => {
    expect(shouldPromptForScore({ ...base, reported: true })).toBe(false);
    expect(shouldPromptForScore({ ...base, dismissedFor: '2026-09-20' })).toBe(false);
    expect(shouldPromptForScore({ ...base, dismissedFor: '2026-01-01' })).toBe(true); // an older sitting's decline
    expect(shouldPromptForScore({ ...base, examDate: null })).toBe(false);
  });
  it(`stops asking after ${PROMPT_MAX_DAYS} days`, () => {
    expect(shouldPromptForScore({ ...base, today: '2027-03-19' })).toBe(true);  // 180
    expect(shouldPromptForScore({ ...base, today: '2027-03-20' })).toBe(false); // 181
  });
});

function sessionsClient(rows: Record<string, unknown>[]) {
  const calls: [string, ...unknown[]][] = [];
  const chain: Record<string, unknown> = {
    then: (res: (v: unknown) => void) => res({ data: rows, error: null }),
  };
  for (const m of ['select', 'eq', 'not', 'lt', 'order', 'limit']) {
    chain[m] = (...args: unknown[]) => { calls.push([m, ...args]); return chain; };
  }
  return { client: { from: vi.fn(() => chain) } as unknown as SupabaseClient, calls };
}

describe('predictionBefore', () => {
  it('snapshots the stats-page estimate over timed exams completed before the test day (Israel time)', async () => {
    // Newest first, as the query orders them.
    const rows = [
      { completed_at: '2026-10-28T09:00:00Z', theta_final: 1.9, theta_se: 0.41, p_exempt: 0.69, section_results: [] },
      { completed_at: '2026-10-25T09:00:00Z', theta_final: 1.55, theta_se: 0.42, p_exempt: 0.36, section_results: [] },
      { completed_at: '2026-10-20T09:00:00Z', theta_final: 1.35, theta_se: 0.43, p_exempt: 0.21, section_results: [] },
    ];
    const { client, calls } = sessionsClient(rows);
    const snap = await predictionBefore(client, 'u1', '2026-11-01');

    // Cut-off: local midnight of 1 Nov 2026 (IST, UTC+2) = 31 Oct 22:00 UTC.
    expect(calls).toEqual(expect.arrayContaining([
      ['eq', 'user_id', 'u1'], ['eq', 'is_practice', false],
      ['lt', 'completed_at', '2026-10-31T22:00:00.000Z'],
      ['order', 'completed_at', { ascending: false }], ['limit', 3],
    ]));
    const expected = currentEstimate([
      { theta: 1.35, se: 0.43, p: 0.21 }, { theta: 1.55, se: 0.42, p: 0.36 }, { theta: 1.9, se: 0.41, p: 0.69 },
    ])!;
    expect(snap.app_theta).toBeCloseTo(expected.measurement.theta, 12);
    expect(snap.app_se).toBeCloseTo(expected.measurement.se, 12);
    expect(snap.app_p_exempt).toBeCloseTo(expected.measurement.p, 12);
    expect(snap.app_score).toBe(thetaToScore(expected.measurement.theta));
    expect(snap.app_exams_used).toBe(3);
    expect(snap.app_days_before).toBe(4); // last exam 28 Oct → test 1 Nov
  });

  it('is all-null when the student took no timed exam before the test', async () => {
    const { client } = sessionsClient([]);
    expect(await predictionBefore(client, 'u1', '2026-11-01')).toEqual({
      app_theta: null, app_se: null, app_score: null, app_p_exempt: null, app_exams_used: null, app_days_before: null,
    });
  });
});
