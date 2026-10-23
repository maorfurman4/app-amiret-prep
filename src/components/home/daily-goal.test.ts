// @vitest-environment happy-dom
import { act, createElement, useEffect } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const m = vi.hoisted(() => ({
  data: null as unknown,
  patch: vi.fn(),
  authFetch: vi.fn(),
  confettiCreate: vi.fn(),
  fire: vi.fn(),
}));

vi.mock('@/lib/dashboard-context', () => ({ useDashboardSummary: () => ({ data: m.data, loading: false, patch: m.patch }) }));
vi.mock('@/lib/auth-fetch', () => ({ authFetch: m.authFetch }));
vi.mock('@/lib/supabase', () => ({
  createClient: () => ({ auth: { getSession: async () => ({ data: { session: { user: { id: 'u1' } } } }) } }),
}));
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

import { DailyGoalPrompt } from './DailyGoalPrompt';
import { GoalMetCelebration } from './GoalMetCelebration';
import { StreakCelebration } from './StreakCelebration';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const summary = ({ done = 0, target = 15, streak = 0, hasActivityToday = false, account = true } = {}) => ({
  streak,
  hasActivityToday,
  canSetExamDate: account,
  officialScorePrompt: null,
  rings: { effort: { done, target }, retention: { done: 0, due: 0 }, simulation: { done: false } },
});

let root: Root | null = null;
async function render(...components: (() => unknown)[]) {
  const host = document.createElement('div');
  document.body.append(host);
  root = createRoot(host);
  await act(async () => { root!.render(components.map((c, i) => createElement(c as () => null, { key: i }))); });
}
async function remount(...components: (() => unknown)[]) {
  await act(async () => root?.unmount());
  document.body.innerHTML = '';
  await render(...components);
}
const advance = (ms: number) => act(async () => { await vi.advanceTimersByTimeAsync(ms); });
const goalDialog = () => document.querySelector<HTMLDialogElement>('[data-goal-reward]');
const streakDialog = () => document.querySelector<HTMLDialogElement>('dialog.neon-reward');
const byText = (text: string) => [...document.querySelectorAll<HTMLButtonElement>('button')].find(b => b.textContent?.trim() === text)!;

function reducedMotion(on: boolean) {
  vi.stubGlobal('matchMedia', (q: string) => ({ matches: on && q.includes('reduce'), media: q, addEventListener() {}, removeEventListener() {} }));
}

beforeEach(() => {
  vi.useFakeTimers();
  vi.clearAllMocks();
  localStorage.clear();
  reducedMotion(false);
  m.confettiCreate.mockReturnValue(Object.assign(m.fire, { reset: vi.fn() }));
  // happy-dom's <dialog> has no top layer; open/close is all these tests need.
  HTMLDialogElement.prototype.showModal = function () { this.setAttribute('open', ''); };
  HTMLDialogElement.prototype.close = function () { this.removeAttribute('open'); };
  m.authFetch.mockResolvedValue(new Response(JSON.stringify({ ok: true }), { status: 200 }));
});

afterEach(async () => {
  await act(async () => root?.unmount());
  root = null;
  document.body.innerHTML = '';
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe('goal-met celebration', () => {
  it('does not fire before the target is reached', async () => {
    m.data = summary({ done: 14 });
    await render(GoalMetCelebration);
    await advance(2000);
    expect(goalDialog()).toBeNull();
    expect(localStorage.getItem('amiret_goal_celebration_seen_date')).toBeNull();
  });

  it('fires once the day the target is reached, with layered confetti', async () => {
    m.data = summary({ done: 15 });
    await render(GoalMetCelebration);
    await advance(700);
    const d = goalDialog()!;
    expect(d.hasAttribute('open')).toBe(true);
    expect(d.textContent).toContain('עמדת ביעד היום! 🎯');
    expect(d.textContent).toContain('15 מתוך 15 שאלות');
    expect(localStorage.getItem('amiret_goal_celebration_seen_date')).toBe('2026-10-23');

    await advance(400);
    expect(m.confettiCreate).toHaveBeenCalledOnce();
    const bursts = m.fire.mock.calls.map(([o]) => o);
    expect(bursts.map(b => b.particleCount)).toEqual([110, 70, 40, 40]);
    expect(bursts.map(b => b.spread)).toEqual([68, 110, 55, 55]);
    expect(bursts.map(b => b.angle)).toEqual([undefined, undefined, 60, 120]);
    for (const b of bursts) expect(b.colors).toEqual(['#e3b45e', '#f2a324', '#aeb8f2', '#8fd7a8', '#e58c7d', '#f4efe3']);
  });

  it('does not fire again that day', async () => {
    m.data = summary({ done: 15 });
    await render(GoalMetCelebration);
    await advance(700);
    await act(async () => byText('ממשיכים').click());
    expect(goalDialog()).toBeNull();

    m.data = summary({ done: 22 });
    await remount(GoalMetCelebration);
    await advance(2000);
    expect(goalDialog()).toBeNull();
  });

  it('closes on Escape', async () => {
    m.data = summary({ done: 15 });
    await render(GoalMetCelebration);
    await advance(700);
    await act(async () => { goalDialog()!.dispatchEvent(new Event('cancel', { cancelable: true })); });
    expect(goalDialog()).toBeNull();
  });

  it('renders a calm, confetti-free version for reduced motion', async () => {
    reducedMotion(true);
    m.data = summary({ done: 15 });
    await render(GoalMetCelebration);
    await advance(1500);
    const d = goalDialog()!;
    expect(d.dataset.reducedMotion).toBe('true');
    expect(d.textContent).toContain('עמדת ביעד היום!');
    expect(m.confettiCreate).not.toHaveBeenCalled();
    expect(m.fire).not.toHaveBeenCalled();
  });
});

describe('with the streak celebration', () => {
  it('shows the streak first, then the goal once the streak closes', async () => {
    m.data = summary({ done: 15, streak: 3, hasActivityToday: true });
    await render(StreakCelebration, GoalMetCelebration);
    await advance(300);
    expect(streakDialog()?.hasAttribute('open')).toBe(true);
    await advance(1000);
    expect(goalDialog()).toBeNull();

    await act(async () => { document.querySelector<HTMLButtonElement>('button[aria-label="סגירת החגיגה"]')!.click(); });
    expect(streakDialog()).toBeNull();
    expect(goalDialog()?.hasAttribute('open')).toBe(true);
    expect(localStorage.getItem('amiret_streak_celebration_seen_date')).toBe('2026-10-23');
    expect(localStorage.getItem('amiret_goal_celebration_seen_date')).toBe('2026-10-23');
  });

  it('leaves the streak celebration as it was on a day the goal is not met', async () => {
    m.data = summary({ done: 3, streak: 4, hasActivityToday: true });
    await render(StreakCelebration, GoalMetCelebration);
    await advance(300);
    expect(streakDialog()?.textContent).toContain('ימים ברצף');
    await advance(3800);
    expect(streakDialog()).toBeNull();
    expect(goalDialog()).toBeNull();
  });

  it('shows the goal at once when the streak already celebrated today', async () => {
    localStorage.setItem('amiret_streak_celebration_seen_date', '2026-10-23');
    m.data = summary({ done: 15, streak: 3, hasActivityToday: true });
    await render(StreakCelebration, GoalMetCelebration);
    await advance(700);
    expect(streakDialog()).toBeNull();
    expect(goalDialog()?.hasAttribute('open')).toBe(true);
  });
});

describe('new-user goal prompt', () => {
  it('asks an account once; "לא עכשיו" stops it for good', async () => {
    m.data = summary();
    await render(DailyGoalPrompt);
    expect(document.querySelector('[data-goal-prompt]')?.textContent).toContain('מה היעד היומי שלך?');
    await act(async () => byText('לא עכשיו').click());
    expect(document.querySelector('[data-goal-prompt]')).toBeNull();
    expect(localStorage.getItem('amiret_goal_prompt_asked:u1')).toBe('1');

    await remount(DailyGoalPrompt);
    expect(document.querySelector('[data-goal-prompt]')).toBeNull();
    expect(m.authFetch).not.toHaveBeenCalled();
  });

  it('saves the chosen target, updates the home ring, and stops asking', async () => {
    m.data = summary();
    await render(DailyGoalPrompt);
    await act(async () => document.querySelector<HTMLButtonElement>('button[aria-label="יותר שאלות"]')!.click());
    await act(async () => byText('שמירת היעד').click());
    expect(m.authFetch).toHaveBeenCalledWith('/api/goals', expect.objectContaining({ method: 'PUT', body: JSON.stringify({ dailyActivityTarget: 20 }) }));
    expect(m.patch).toHaveBeenCalledWith({ rings: expect.objectContaining({ effort: { done: 0, target: 20 } }) });
    expect(document.querySelector('[data-goal-prompt]')).toBeNull();
    expect(localStorage.getItem('amiret_goal_prompt_asked:u1')).toBe('1');
  });

  it('keeps asking when the save fails', async () => {
    m.authFetch.mockResolvedValue(new Response('{}', { status: 500 }));
    m.data = summary();
    await render(DailyGoalPrompt);
    await act(async () => byText('שמירת היעד').click());
    expect(document.querySelector('[data-goal-prompt]')?.textContent).toContain('השמירה נכשלה');
    expect(localStorage.getItem('amiret_goal_prompt_asked:u1')).toBeNull();
  });

  it('does not ask a guest, who cannot store a goal', async () => {
    m.data = summary({ account: false });
    await render(DailyGoalPrompt);
    expect(document.querySelector('[data-goal-prompt]')).toBeNull();
  });
});
