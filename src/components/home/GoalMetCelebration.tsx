'use client';

import { useEffect, useRef, useState } from 'react';
import { Check } from 'lucide-react';
import { useDashboardSummary } from '@/lib/dashboard-context';
import { todayLocalStr } from '@/lib/date-local';
import { GOAL_SEEN_KEY } from '@/lib/daily-goal';

/** The app's palette, for the confetti. */
const CONFETTI_COLORS = ['#e3b45e', '#f2a324', '#aeb8f2', '#8fd7a8', '#e58c7d', '#f4efe3'];
/** After StreakCelebration's own 300ms delay, so its dialog is in the DOM if it's coming. */
const START_DELAY_MS = 700;
/** StreakCelebration's dialog. Read, not changed: the goal waits for it to close. */
const STREAK_DIALOG = 'dialog.neon-reward';

const RING_R = 54;
const RING_C = 2 * Math.PI * RING_R;

/**
 * "You hit today's goal": once a day, when today's practice questions reach
 * the daily goal (dashboard-summary's rings.effort, the same done/target the
 * home plan shows). A separate moment from the streak's: on a day both fire,
 * the streak shows first and this one waits for it to close.
 */
export function GoalMetCelebration() {
  const { data } = useDashboardSummary();
  const effort = data?.rings.effort;
  const met = !!effort && effort.target > 0 && effort.done >= effort.target;
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (!met) return;
    const today = todayLocalStr();
    try { if (localStorage.getItem(GOAL_SEEN_KEY) === today) return; } catch { /* Session-only fallback. */ }

    let observer: MutationObserver | null = null;
    const show = () => {
      observer?.disconnect();
      try { localStorage.setItem(GOAL_SEEN_KEY, today); } catch { /* Storage is optional. */ }
      setVisible(true);
    };
    const timer = setTimeout(() => {
      if (!document.querySelector(STREAK_DIALOG)) { show(); return; }
      observer = new MutationObserver(() => { if (!document.querySelector(STREAK_DIALOG)) show(); });
      observer.observe(document.body, { childList: true, subtree: true });
    }, START_DELAY_MS);
    return () => { clearTimeout(timer); observer?.disconnect(); };
  }, [met]);

  if (!visible || !effort) return null;
  return <GoalReward target={effort.target} onDismiss={() => setVisible(false)} />;
}

/**
 * The dialog: a target ring that closes to 100% around a check, with physics
 * confetti. Reduced motion gets the same dialog, ring already full, no confetti.
 * Native <dialog> gives focus containment, Escape and focus return.
 */
export function GoalReward({ target, onDismiss }: { target: number; onDismiss: () => void }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const [reduced] = useState(() => typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches);
  const [filled, setFilled] = useState(reduced);

  useEffect(() => {
    const element = dialog.current;
    const previousFocus = document.activeElement;
    element?.showModal();
    const frame = requestAnimationFrame(() => setFilled(true));

    let live = true;
    let reset: (() => void) | undefined;
    if (!reduced && canvas.current) {
      const target = canvas.current;
      // Loaded on demand: most visits never celebrate.
      import('canvas-confetti').then(({ default: confetti }) => {
        if (!live) return;
        const fire = confetti.create(target, { resize: true });
        reset = () => fire.reset();
        const base = { colors: CONFETTI_COLORS, disableForReducedMotion: true };
        fire({ ...base, particleCount: 110, spread: 68, startVelocity: 48, origin: { x: 0.5, y: 0.58 }, scalar: 1 });
        setTimeout(() => live && fire({ ...base, particleCount: 70, spread: 110, startVelocity: 34, origin: { x: 0.5, y: 0.6 }, scalar: 0.9 }), 180);
        setTimeout(() => {
          if (!live) return;
          fire({ ...base, particleCount: 40, angle: 60, spread: 55, startVelocity: 52, origin: { x: 0, y: 0.72 }, scalar: 0.95 });
          fire({ ...base, particleCount: 40, angle: 120, spread: 55, startVelocity: 52, origin: { x: 1, y: 0.72 }, scalar: 0.95 });
        }, 320);
      }).catch(() => { /* No confetti; the dialog still stands. */ });
    }

    return () => {
      live = false;
      cancelAnimationFrame(frame);
      reset?.();
      element?.close();
      if (previousFocus instanceof HTMLElement && previousFocus.isConnected) previousFocus.focus();
    };
  }, [reduced]);

  return (
    <dialog
      ref={dialog}
      dir="rtl"
      aria-labelledby="goal-met-title"
      aria-describedby="goal-met-count"
      onCancel={e => { e.preventDefault(); onDismiss(); }}
      data-goal-reward
      data-reduced-motion={reduced}
      className="m-0 h-dvh max-h-none w-screen max-w-none overflow-hidden bg-transparent p-0 text-exam-ink backdrop:bg-black/60 backdrop:backdrop-blur-[3px]"
    >
      <div className="grid h-full place-items-center p-3">
        <div className={`relative w-[min(380px,100%)] rounded-[28px] border border-exam-border bg-exam-surface px-6 pt-8 pb-6 text-center shadow-overlay ${reduced ? '' : 'animate-modal-in'}`}>
          <div className="relative mx-auto size-[132px]">
            <svg viewBox="0 0 128 128" className="size-full" aria-hidden>
              <circle cx="64" cy="64" r={RING_R} fill="none" strokeWidth="10" className="stroke-exam-border" />
              <circle
                cx="64" cy="64" r={RING_R} fill="none" strokeWidth="10" strokeLinecap="round"
                className="stroke-exam-accent transition-[stroke-dashoffset] duration-[900ms] ease-spring-soft motion-reduce:transition-none"
                strokeDasharray={RING_C}
                strokeDashoffset={filled ? 0 : RING_C}
                transform="rotate(-90 64 64)"
              />
            </svg>
            <span className={`absolute inset-0 m-auto grid size-16 place-items-center rounded-full bg-exam-accent text-exam-accent-ink shadow-raised transition-[transform,opacity] duration-500 ease-spring delay-[700ms] motion-reduce:transition-none ${filled ? 'scale-100 opacity-100' : 'scale-50 opacity-0'}`} aria-hidden>
              <Check className="w-8 h-8" strokeWidth={3} />
            </span>
          </div>
          <h2 id="goal-met-title" className="mt-5 text-[22px] font-extrabold tracking-[-0.02em]">עמדת ביעד היום! 🎯</h2>
          <p id="goal-met-count" className="mt-1.5 text-[15px] text-exam-ink-soft">
            <bdi className="font-bold text-exam-ink tabular-nums">{target}</bdi> מתוך <bdi className="font-bold text-exam-ink tabular-nums">{target}</bdi> שאלות
          </p>
          <button
            type="button"
            autoFocus
            onClick={onDismiss}
            className="mt-6 h-12 w-full rounded-xl bg-exam-accent font-bold text-exam-accent-ink shadow-raised transition-[transform,box-shadow] duration-300 ease-spring hover:-translate-y-0.5 active:translate-y-0 active:scale-[0.97] active:shadow-pressed"
          >
            ממשיכים
          </button>
        </div>
      </div>
      {/* Over the card, under nothing: clicks pass through to the button. */}
      <canvas ref={canvas} className="pointer-events-none fixed inset-0 size-full" aria-hidden />
    </dialog>
  );
}
