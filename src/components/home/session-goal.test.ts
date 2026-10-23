// @vitest-environment happy-dom
import { act, createElement, useEffect, type ReactElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const m = vi.hoisted(() => ({
  authFetch: vi.fn(),
  confettiCreate: vi.fn(),
  fire: vi.fn(),
  effort: { done: 15, target: 15 },
  streak: [] as { streak: number; hasActivityToday: boolean }[],
}));

vi.mock('@/lib/auth-fetch', () => ({ authFetch: m.authFetch }));
vi.mock('@/lib/date-local', async importOriginal => ({
  ...(await importOriginal<typeof import('@/lib/date-local')>()),
  todayLocalStr: () => '2026-10-23',
}));
vi.mock('canvas-confetti', () => ({ default: { create: m.confettiCreate } }));
// The streak dialog waits for its flame image; load it at once.
vi.mock('next/image', async () => {
  const { createElement: h } = await import('react');
  function LoadedImage({ onLoad, alt }: { onLoad?: () => void; alt: string }) {
    useEffect(() => { onLoad?.(); }, [onLoad]);
    return h('img', { alt });
  }
  return { default: LoadedImage };
});

import { SessionGoalCelebration } from './SessionGoalCelebration';
import { GoalMetCelebration } from './GoalMetCelebration';
import { SessionStreakCelebration } from './StreakCelebration';
import { DashboardSummaryProvider } from '@/lib/dashboard-context';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const TODAY = '2026-10-23';
const GOAL_SEEN = 'amiret_goal_celebration_seen_date';
const STREAK_SEEN = 'amiret_streak_celebration_seen_date';

const json = (body: unknown) => Promise.resolve(new Response(JSON.stringify(body), { status: 200 }));

/** A completion screen, as practice / diagnostic / results mount them. */
const completionScreen = () => [createElement(SessionStreakCelebration, { key: 's' }), createElement(SessionGoalCelebration, { key: 'g' })];
/** Home, as page.tsx mounts the goal. */
const home = () => createElement(DashboardSummaryProvider, null, createElement(GoalMetCelebration));

let root: Root | null = null;
async function render(tree: ReactElement | ReactElement[]) {
  const host = document.createElement('div');
  document.body.append(host);
  root = createRoot(host);
  await act(async () => { root!.render(tree); });
}
async function leave() {
  await act(async () => root?.unmount());
  root = null;
  document.body.innerHTML = '';
}
const advance = (ms: number) => act(async () => { await vi.advanceTimersByTimeAsync(ms); });
/** Small steps, so React commits (and starts new timers) between them as a browser would. */
async function elapse(ms: number) {
  for (let t = 0; t < ms; t += 250) await advance(250);
}
const goalDialog = () => document.querySelector<HTMLDialogElement>('[data-goal-reward]');
const streakDialog = () => document.querySelector<HTMLDialogElement>('dialog.neon-reward');

function reducedMotion(on: boolean) {
  vi.stubGlobal('matchMedia', (q: string) => ({ matches: on && q.includes('reduce'), media: q, addEventListener() {}, removeEventListener() {} }));
}

beforeEach(() => {
  vi.useFakeTimers();
  vi.clearAllMocks();
  localStorage.clear();
  reducedMotion(false);
  m.effort = { done: 15, target: 15 };
  m.streak = [{ streak: 4, hasActivityToday: true }];
  m.confettiCreate.mockReturnValue(Object.assign(m.fire, { reset: vi.fn() }));
  HTMLDialogElement.prototype.showModal = function () { this.setAttribute('open', ''); };
  HTMLDialogElement.prototype.close = function () { this.removeAttribute('open'); };
  m.authFetch.mockImplementation((url: string) => {
    if (url === '/api/streak') return json(m.streak.length > 1 ? m.streak.shift() : m.streak[0]);
    if (url.startsWith('/api/dashboard-summary')) {
      return json({ streak: 4, hasActivityToday: true, canSetExamDate: true, officialScorePrompt: null, rings: { effort: m.effort, retention: { done: 0, due: 0 }, simulation: { done: false } } });
    }
    return json({});
  });
});

afterEach(async () => {
  await leave();
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe('goal-met celebration on the completion screen', () => {
  it('shows when the session crossed the daily target, with the same N מתוך N as home', async () => {
    localStorage.setItem(STREAK_SEEN, TODAY);
    await render(completionScreen());
    await elapse(1000);
    const d = goalDialog()!;
    expect(d.hasAttribute('open')).toBe(true);
    expect(d.textContent).toContain('15 מתוך 15 שאלות');
    expect(localStorage.getItem(GOAL_SEEN)).toBe(TODAY);
    expect(m.authFetch).toHaveBeenCalledWith(expect.stringMatching(/^\/api\/dashboard-summary/));
  });

  it('does not show before the target is reached', async () => {
    localStorage.setItem(STREAK_SEEN, TODAY);
    m.effort = { done: 12, target: 15 };
    await render(completionScreen());
    await elapse(8000);
    expect(goalDialog()).toBeNull();
    expect(localStorage.getItem(GOAL_SEEN)).toBeNull();
  });

  it('then does not fire again on home that day (one shared flag)', async () => {
    localStorage.setItem(STREAK_SEEN, TODAY);
    await render(completionScreen());
    await elapse(1000);
    expect(goalDialog()).not.toBeNull();
    await act(async () => [...document.querySelectorAll('button')].find(b => b.textContent === 'ממשיכים')!.click());
    await leave();

    await render(home());
    await elapse(3000);
    expect(goalDialog()).toBeNull();
  });

  it('does not fire on the completion screen when home already celebrated today', async () => {
    localStorage.setItem(STREAK_SEEN, TODAY);
    await render(home());
    await elapse(1000);
    expect(goalDialog()).not.toBeNull();
    await leave();

    await render(completionScreen());
    await elapse(8000);
    expect(goalDialog()).toBeNull();
  });

  it('waits for a streak that takes a retry to arrive, then shows after it closes', async () => {
    // The answers haven't marked today yet on the first ask (SessionStreakCelebration re-asks at 1s).
    m.streak = [{ streak: 3, hasActivityToday: false }, { streak: 4, hasActivityToday: true }];
    await render(completionScreen());
    await elapse(1000);
    expect(goalDialog()).toBeNull();
    await elapse(600);
    expect(streakDialog()?.hasAttribute('open')).toBe(true);
    await elapse(1500);
    expect(goalDialog()).toBeNull();

    await act(async () => { document.querySelector<HTMLButtonElement>('button[aria-label="סגירת החגיגה"]')!.click(); });
    expect(streakDialog()).toBeNull();
    expect(goalDialog()?.hasAttribute('open')).toBe(true);
  });

  it('shows after a fixed wait when the streak never comes', async () => {
    m.authFetch.mockImplementation((url: string) => (url === '/api/streak'
      ? Promise.reject(new Error('offline'))
      : json({ rings: { effort: m.effort, retention: { done: 0, due: 0 }, simulation: { done: false } } })));
    await render(completionScreen());
    await elapse(5000);
    expect(goalDialog()).toBeNull();
    // 6s for the streak, then the summary fetch and GoalMetCelebration's own 700ms.
    await elapse(2000);
    expect(goalDialog()?.hasAttribute('open')).toBe(true);
    expect(streakDialog()).toBeNull();
  });

  it('keeps reduced motion confetti-free', async () => {
    reducedMotion(true);
    localStorage.setItem(STREAK_SEEN, TODAY);
    await render(completionScreen());
    await elapse(1500);
    expect(goalDialog()?.dataset.reducedMotion).toBe('true');
    expect(m.confettiCreate).not.toHaveBeenCalled();
  });

  it('fires confetti otherwise', async () => {
    localStorage.setItem(STREAK_SEEN, TODAY);
    await render(completionScreen());
    await elapse(1500);
    expect(m.confettiCreate).toHaveBeenCalledOnce();
  });
});
