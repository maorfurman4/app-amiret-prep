'use client';

import { useEffect, useEffectEvent, useRef, useState, type CSSProperties } from 'react';
import Image from 'next/image';
import { X } from 'lucide-react';
import { useDashboardSummary } from '@/lib/dashboard-context';
import { todayLocalStr } from '@/lib/date-local';
import { RollingNumber } from './AchievementMotion';

const SEEN_KEY = 'amiret_streak_celebration_seen_date';

/** An earned, once-a-day moment. Yesterday's active streak is not a new win. */
export function StreakCelebration() {
  const { data } = useDashboardSummary();
  const streak = data?.streak ?? 0;
  const earnedToday = data?.hasActivityToday ?? false;
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (streak < 1 || !earnedToday) return;
    const today = todayLocalStr();
    try { if (localStorage.getItem(SEEN_KEY) === today) return; } catch { /* Session-only fallback. */ }
    const timer = setTimeout(() => {
      try { localStorage.setItem(SEEN_KEY, today); } catch { /* Storage is optional. */ }
      setVisible(true);
    }, 300);
    return () => clearTimeout(timer);
  }, [streak, earnedToday]);

  if (!visible) return null;
  return <StreakReward streak={streak} onDismiss={() => setVisible(false)} />;
}

/** Native dialog supplies focus containment, Escape and focus restoration. */
export function StreakReward({ streak, onDismiss, hold = false }: { streak: number; onDismiss: () => void; hold?: boolean }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [ready, setReady] = useState(false);
  const dismiss = useEffectEvent(onDismiss);
  const stage = streak >= 30 ? 3 : streak >= 7 ? 2 : 1;
  const sparks = stage === 3 ? 38 : stage === 2 ? 26 : 14;

  useEffect(() => {
    if (!ready) return;
    const element = dialog.current;
    const previousFocus = document.activeElement;
    element?.showModal();
    return () => {
      element?.close();
      if (previousFocus instanceof HTMLElement && previousFocus.isConnected) previousFocus.focus();
    };
  }, [ready]);

  useEffect(() => {
    if (!ready || hold) return;
    const timer = setTimeout(() => dismiss(), 3800);
    return () => clearTimeout(timer);
  }, [ready, hold]);

  return (
    <dialog ref={dialog} className="neon-reward" dir="rtl" aria-labelledby="neon-streak-title" onCancel={onDismiss}>
      <div className="neon-scene" data-ready={ready} data-stage={stage} data-hold={hold}>
        <button autoFocus type="button" onClick={onDismiss} aria-label="סגירת החגיגה" className="neon-close"><X size={20} aria-hidden /></button>
        <div className="neon-brand" dir="ltr">134<span>+</span></div>
        <p className="neon-eyebrow">{stage === 3 ? 'ההתמדה שלך זוהרת' : stage === 2 ? 'האש שלך מתחזקת' : 'כל יום מתחיל בניצוץ'}</p>
        <div className="neon-stage" aria-hidden="true">
          <div className="neon-aura" />
          <div className="neon-orbit neon-orbit-one" />
          {stage >= 2 && <div className="neon-orbit neon-orbit-two" />}
          {stage >= 3 && <div className="neon-orbit neon-orbit-three" />}
          <div className="neon-flame-wrap">
            <Image src="/images/gamification/neon-flame.png" alt="" width={768} height={768} sizes="(max-width: 480px) 80vw, 360px" priority className="neon-flame" onLoad={() => setReady(true)} onError={() => setReady(true)} />
            {stage >= 3 && <div className="neon-crown" />}
          </div>
          <div className="neon-burst" />
          {Array.from({ length: sparks }, (_, i) => {
            const angle = (i * 137.508) * Math.PI / 180;
            const distance = 95 + (i % 6) * 17;
            return <i key={i} className="neon-spark" style={{ '--spark-x': `${Math.cos(angle) * distance}px`, '--spark-y': `${Math.sin(angle) * distance - 35}px`, '--spark-delay': `${860 + (i % 7) * 45}ms`, '--spark-size': `${i % 4 === 0 ? 4 : 2}px` } as CSSProperties} />;
          })}
        </div>
        <div className="neon-copy">
          <h2 id="neon-streak-title"><span className="neon-count">{ready ? <RollingNumber value={streak} from={hold ? streak : streak - 1} /> : streak}</span><span className="neon-label">{streak === 1 ? 'יום ראשון ברצף' : 'ימים ברצף'}</span></h2>
          <p>צעד קטן כל יום, וזה מצטבר.</p>
          <div className="neon-stage-label">{stage === 1 ? 'ניצוץ · תחילת הדרך' : stage === 2 ? 'להבה · שבוע ומעלה' : 'אנרגיה · חודש ומעלה'}</div>
        </div>
      </div>
    </dialog>
  );
}
