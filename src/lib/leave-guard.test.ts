import { describe, expect, it, vi } from 'vitest';
import { LeaveGuard, isLeaveGuardEntry, type GuardWindow } from './leave-guard';

/** A history stack whose back() pops and fires popstate, like a browser. */
function fakeWindow() {
  const stack: unknown[] = [{ page: 'home' }, { page: 'practice' }];
  let index = 1;
  const listeners = new Set<() => void>();
  const win: GuardWindow = {
    history: {
      get state() { return stack[index]; },
      pushState(state: unknown) { stack.splice(index + 1); stack.push(state); index++; },
      back() { if (index > 0) { index--; listeners.forEach(l => l()); } },
    } as GuardWindow['history'],
    addEventListener: (_t, l) => { listeners.add(l); },
    removeEventListener: (_t, l) => { listeners.delete(l); },
  };
  return { win, stack, at: () => stack[index], depth: () => stack.slice(0, index + 1).length, listeners };
}

describe('LeaveGuard', () => {
  it('asks on Back, and stays on the run when the student says no', () => {
    const w = fakeWindow();
    const confirmLeave = vi.fn(() => false);
    const navigate = vi.fn();
    new LeaveGuard(w.win, { confirmLeave, navigate }).attach();

    w.win.history.back();

    expect(confirmLeave).toHaveBeenCalledOnce();
    expect(isLeaveGuardEntry(w.at())).toBe(true); // guard is back in place
    expect(navigate).not.toHaveBeenCalled();
  });

  it('finishes the Back when the student confirms', () => {
    const w = fakeWindow();
    new LeaveGuard(w.win, { confirmLeave: () => true, navigate: vi.fn() }).attach();

    w.win.history.back();

    expect(w.at()).toEqual({ page: 'home' });
    expect(w.listeners.size).toBe(0);
  });

  it('adds only one guard entry, however often it is attached', () => {
    const w = fakeWindow();
    const guard = new LeaveGuard(w.win, { confirmLeave: () => false, navigate: vi.fn() });
    guard.attach();
    guard.detach();
    guard.attach(); // React StrictMode re-runs effects
    expect(w.depth()).toBe(3);
  });

  it('exits on purpose by stepping over its entry, then navigating', () => {
    const w = fakeWindow();
    const confirmLeave = vi.fn(() => false);
    const navigate = vi.fn();
    const guard = new LeaveGuard(w.win, { confirmLeave, navigate });
    guard.attach();

    guard.leave('/');

    expect(confirmLeave).not.toHaveBeenCalled();
    expect(navigate).toHaveBeenCalledWith('/');
    expect(w.at()).toEqual({ page: 'practice' });
  });

  it('still leaves if the step-back never fires popstate', () => {
    const w = fakeWindow();
    const navigate = vi.fn();
    const guard = new LeaveGuard(w.win, { confirmLeave: () => false, navigate });
    guard.attach();
    w.win.removeEventListener('popstate', guard.onPopState); // simulate a lost popstate
    guard.leave('/');
    expect(navigate).not.toHaveBeenCalled();
    guard.flushLeave();
    expect(navigate).toHaveBeenCalledWith('/');
  });

  it('drops its entry when the run ends on the page', () => {
    const w = fakeWindow();
    const confirmLeave = vi.fn(() => false);
    const guard = new LeaveGuard(w.win, { confirmLeave, navigate: vi.fn() });
    guard.attach();

    guard.release();

    expect(w.at()).toEqual({ page: 'practice' });
    expect(confirmLeave).not.toHaveBeenCalled();
    w.win.history.back(); // a normal Back now just goes back
    expect(w.at()).toEqual({ page: 'home' });
  });
});
