/**
 * Asks before browser/OS Back throws away a run that has nothing to resume
 * from (practice, /today, the diagnostic). Back is a client-side navigation
 * there, so beforeunload never fires: it used to drop the run silently.
 *
 * Same technique as the live exam's guard: an extra history entry for this
 * same URL. Back pops that entry; we ask, and either finish the Back the
 * student asked for or put the entry back. Leaving on purpose (the exit
 * button) steps back over the entry first, so history stays clean, and a
 * run that ends on the page drops it. Next's patched pushState copies its
 * router state onto the entry, so the router keeps working.
 */

export const LEAVE_GUARD_KEY = 'amiretLeaveGuard';

export function isLeaveGuardEntry(state: unknown): boolean {
  return !!state && typeof state === 'object' && (state as Record<string, unknown>)[LEAVE_GUARD_KEY] === true;
}

export interface GuardWindow {
  history: Pick<History, 'state' | 'pushState' | 'back'>;
  addEventListener(type: 'popstate', listener: () => void): void;
  removeEventListener(type: 'popstate', listener: () => void): void;
}

export interface LeaveGuardOptions {
  /** Asks the student whether to leave (window.confirm in the app). */
  confirmLeave: () => boolean;
  /** Client-side navigation, once the guard entry is stepped over. */
  navigate: (href: string) => void;
}

export class LeaveGuard {
  private leavingTo: string | null = null;
  private attached = false;

  constructor(private readonly win: GuardWindow, private readonly opts: LeaveGuardOptions) {}

  /** Starts guarding; adds the guard entry unless it is already the current one. */
  attach(): void {
    if (this.attached) return;
    if (!isLeaveGuardEntry(this.win.history.state)) {
      this.win.history.pushState({ [LEAVE_GUARD_KEY]: true }, '');
    }
    this.win.addEventListener('popstate', this.onPopState);
    this.attached = true;
  }

  /** Stops listening (unmount); the entry stays, as after any navigation. */
  detach(): void {
    this.win.removeEventListener('popstate', this.onPopState);
    this.attached = false;
  }

  /** The run ended on this page: stop guarding and drop the guard entry. */
  release(): void {
    this.detach();
    if (isLeaveGuardEntry(this.win.history.state)) this.win.history.back();
  }

  /** Leaves on purpose for `href`, stepping back over the guard entry first. */
  leave(href: string): void {
    if (!this.attached || !isLeaveGuardEntry(this.win.history.state)) {
      this.detach();
      this.opts.navigate(href);
      return;
    }
    this.leavingTo = href;
    this.win.history.back();
  }

  /** Completes a leave() whose step-back never produced a popstate (it always should). */
  flushLeave(): void {
    const target = this.leavingTo;
    if (!target) return;
    this.leavingTo = null;
    this.detach();
    this.opts.navigate(target);
  }

  readonly onPopState = (): void => {
    const target = this.leavingTo;
    if (target) {
      this.leavingTo = null;
      this.detach();
      this.opts.navigate(target);
      return;
    }
    if (this.opts.confirmLeave()) {
      // Carry on with the Back the student asked for.
      this.detach();
      this.win.history.back();
      return;
    }
    this.win.history.pushState({ [LEAVE_GUARD_KEY]: true }, '');
  };
}
