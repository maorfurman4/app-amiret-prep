'use client';

import { useId, useLayoutEffect, useRef, useState } from 'react';
import { AlertTriangle, ChevronDown } from 'lucide-react';
import { EXEMPTION_SCORE } from '@/lib/calibration';
import { classifyScore } from '@/types/exam';
import { heCount } from '@/lib/hebrew-count';
import type { ExamEffort } from '@/lib/exam-effort';
import { Reveal } from '@/components/strategies/Reveal';
import { PLUS, ScoreTrack, trackPct } from '@/components/stats/ScoreTrack';

const COUNT_MS = 1100;

export function PlusMark({ className }: { className: string }) {
  return <svg viewBox="0 0 24 24" aria-hidden className={className}><path d={PLUS} /></svg>;
}

/**
 * The score panel at the top of the results: the /stats navy panel, with the
 * score standing over its own spot on the 50–150 track, so the first glance
 * answers "did I reach 134?". Under it the bracket, the distance to 134 (in
 * amber, never red: finishing a full exam is worth something whatever the
 * number), and the tallies. A low-effort exam gets its notice tucked under
 * the panel and no "on your way", since the score didn't measure them.
 */
export function ResultsHero({ score, interval, correct, total, meanLevel, hasExperimental, effort }: {
  score: number;
  interval: { lo: number; hi: number } | null;
  correct: number;
  total: number;
  meanLevel: number | null;
  hasExperimental: boolean;
  effort: ExamEffort;
}) {
  const panel = useRef<HTMLElement>(null);
  const num = useRef<HTMLParagraphElement>(null);
  const fill = useRef<HTMLDivElement>(null);
  const noteId = useId();
  const [noteOpen, setNoteOpen] = useState(false);
  const classification = classifyScore(score);
  const passed = score >= EXEMPTION_SCORE;
  const gap = EXEMPTION_SCORE - score;
  const low = effort.lowEffort;

  /**
   * The page's one load moment: the score counts up from 50 while it rides
   * the track (number and knob follow --ride) and the fill grows under it.
   * Crossing 134 turns the knob green and pulses the "+" once (CSS, keyed on
   * data-below / data-crossed). The markup always holds the final state, so
   * screen readers and reduced motion get it as is.
   */
  useLayoutEffect(() => {
    const el = panel.current;
    const text = num.current?.firstChild as Text | undefined;
    if (!el || !text || matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const paint = (v: number) => {
      text.nodeValue = String(Math.round(v));
      el.style.setProperty('--ride', `${trackPct(v)}%`);
      if (fill.current) fill.current.style.width = `${trackPct(v)}%`;
    };
    const settle = () => {
      paint(score);
      el.style.removeProperty('--ride');
      delete el.dataset.counting;
      delete el.dataset.below;
    };
    el.dataset.counting = '';
    if (score >= EXEMPTION_SCORE) el.dataset.below = '';
    delete el.dataset.crossed;
    const start = performance.now();
    let raf = 0;
    const tick = (now: number) => {
      // rAF's frame time can precede `start`; clamp so the count never dips below 50.
      const t = Math.min(1, Math.max(0, (now - start) / COUNT_MS));
      const v = 50 + (score - 50) * (1 - (1 - t) ** 3);
      paint(v);
      if (el.dataset.below !== undefined && Math.round(v) >= EXEMPTION_SCORE) {
        delete el.dataset.below;
        el.dataset.crossed = '';
      }
      if (t < 1) raf = requestAnimationFrame(tick);
      else settle();
    };
    tick(start);
    return () => {
      cancelAnimationFrame(raf);
      settle();
    };
  }, [score]);

  return (
    <div className="flex flex-col">
      <section
        ref={panel}
        aria-labelledby="results-score-heading"
        className="relative z-10 rounded-[28px] bg-stats-hero text-stats-hero-ink shadow-stats-hero px-5 pt-5 pb-2"
      >
        <h2 id="results-score-heading" className="text-sm text-stats-hero-soft">הציון שלך, אומדן פנימי של האתר</h2>

        <div dir="ltr" className="relative h-[1em] mt-2.5 text-[clamp(4.6rem,22vw,5.9rem)]">
          <p
            ref={num}
            data-metric="headline-score"
            className={`absolute bottom-0 w-[1.72em] text-center font-extrabold leading-[0.8] tracking-[-0.045em] tabular-nums ${low ? 'text-stats-hero-soft' : ''}`}
            style={{ left: `clamp(0%, calc(var(--ride, ${trackPct(score)}%) - 0.86em), calc(100% - 1.72em))` }}
          >{score}</p>
        </div>
        <ScoreTrack score={score} best={score} fillRef={fill} range={interval ?? undefined} knob />

        <p className="mt-4 flex items-center gap-1.5 text-lg font-extrabold tracking-[-0.015em]">
          {passed && !low && <PlusMark className="size-3.5 fill-stats-gate" />}
          {classification.label}
        </p>
        <p className="mt-0.5 text-[15px] text-stats-hero-soft" data-metric="points-to-target">
          {low
            ? 'הציון הזה מתאר את קצב המענה, לא את הרמה שלך.'
            : passed
              ? <>עברת את רף ה-<bdi dir="ltr" className="font-bold text-stats-gate">{EXEMPTION_SCORE}</bdi>. את הסף בפועל קובע המוסד.</>
              : gap === 1
                ? <>חסרה <b className="text-stats-best">נקודה אחת</b> לפטור. אתה בדרך.</>
                : <>עוד <b className="text-stats-best tabular-nums">{heCount(gap, 'point')}</b> לפטור. אתה בדרך.</>}
        </p>

        <dl className="mt-4 pt-4 border-t border-white/10 flex flex-wrap gap-x-5 gap-y-3">
          <div className="flex flex-col-reverse">
            <dt className="text-[13px] text-stats-hero-soft">תשובות נכונות</dt>
            <dd className="text-xl font-bold tabular-nums whitespace-nowrap" data-metric="correct-count">
              {correct} <span className="text-[13px] font-medium text-stats-hero-soft">מתוך {total}</span>
            </dd>
          </div>
          {interval && interval.lo !== interval.hi && (
            <div className="flex flex-col-reverse">
              <dt className="text-[13px] text-stats-hero-soft">טווח סביר</dt>
              <dd className="text-xl font-bold tabular-nums whitespace-nowrap"><bdi dir="ltr" data-metric="score-range">{interval.lo}–{interval.hi}</bdi></dd>
            </div>
          )}
          {meanLevel !== null && (
            <div className="flex flex-col-reverse">
              <dt className="text-[13px] text-stats-hero-soft">רמת קושי ממוצעת</dt>
              <dd className="text-xl font-bold tabular-nums whitespace-nowrap"><bdi dir="ltr">{meanLevel}/5</bdi></dd>
            </div>
          )}
        </dl>
        {hasExperimental && (
          <p className="mt-3 text-xs text-stats-hero-soft">התרגול החלופי מוצג בנפרד למטה: הוא לא נספר כאן, וטעויות בו לא הורידו לך את האומדן</p>
        )}

        <button
          type="button"
          aria-expanded={noteOpen}
          aria-controls={noteId}
          onClick={() => setNoteOpen(o => !o)}
          className="mt-1 flex w-full min-h-11 items-center gap-2 rounded-lg text-start text-[13px] text-stats-hero-soft focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-stats-hero-ink"
        >
          הציון תלוי גם בקושי השאלות שעליהן ענית נכון, לא רק במספרן
          <ChevronDown className={`ms-auto size-4 shrink-0 transition-transform duration-300 motion-reduce:transition-none ${noteOpen ? 'rotate-180' : ''}`} aria-hidden />
        </button>
        <Reveal open={noteOpen} id={noteId}>
          <p className="pb-3 text-xs leading-relaxed text-stats-hero-soft" data-testid="adaptive-scoring-note">
            במבחן אדפטיבי הציון לא נקבע לפי אחוז התשובות הנכונות בלבד: כל תשובה נכונה מביאה שאלה קשה יותר, ולכן הציון תלוי גם ברמת הקושי של השאלות שעליהן ענית נכון.
            {meanLevel !== null && <> רמת הקושי הממוצעת של השאלות שקיבלת: <bdi dir="ltr">{meanLevel}/5</bdi>.</>}
          </p>
        </Reveal>
      </section>

      {low && (
        <div
          role="note"
          data-testid="low-effort-notice"
          className="relative mx-2.5 -mt-[18px] pt-[30px] pb-3.5 px-3.5 rounded-b-[20px] bg-exam-alt-bg border border-t-0 border-exam-alt/40 text-sm text-exam-alt leading-relaxed"
        >
          <p className="font-extrabold text-[15px] mb-1 flex items-center gap-1.5">
            <AlertTriangle className="size-4 shrink-0" aria-hidden />
            המבחן הזה לא מדד את הרמה שלך
          </p>
          {effort.rapid} מתוך {effort.answered} התשובות ניתנו תוך שניות בודדות, ושיעור ההצלחה ({effort.correct} מתוך {effort.answered}) לא גבוה מניחוש אקראי.
          {' '}לכן הציון לא נכלל בציון המוביל בסטטיסטיקה, במגמה ובמדד המוכנות. כדי למדוד את הרמה, ענה על המבחן הבא בקצב רגיל.
        </div>
      )}
    </div>
  );
}
