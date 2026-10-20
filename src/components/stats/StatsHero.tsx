'use client';

import Link from 'next/link';
import { useId, useLayoutEffect, useRef } from 'react';
import { PenLine } from 'lucide-react';
import { EXEMPTION_SCORE } from '@/lib/calibration';
import { typeLabel, windowLabel, type StatsMetrics } from '@/lib/stats-metrics';
import { ScoreTrack, trackPct } from './ScoreTrack';

const COUNT_MS = 1100;

/**
 * The top of /stats, on the navy panel: where the student is now (the
 * score of the latest exam — an actual result, not a modelled estimate), how far 134 is on the 50–150 scale, exams taken and
 * the best score; tucked under it, the single next step. Everything is
 * read from StatsMetrics, never recomputed.
 */
export function StatsHero({ metrics }: { metrics: StatsMetrics }) {
  const { measured, examCount, bestScore, weakest, recent } = metrics;
  const headingId = useId();
  const panel = useRef<HTMLElement>(null);
  const fill = useRef<HTMLDivElement>(null);
  const score = measured.score;

  /**
   * The page's one load moment: every [data-count] number on the panel rises
   * from its data-count-from to its value while the track fills to the
   * score, then the hatched "still to go" stretch fades in (CSS, keyed on
   * data-counting). The markup always holds the final values, so server
   * render, screen readers and reduced motion all get them as is.
   */
  useLayoutEffect(() => {
    const el = panel.current;
    if (!el || matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    // Write into React's own text node, so a later render still finds it.
    const nums = [...el.querySelectorAll<HTMLElement>('[data-count]')].map(n => ({
      text: n.firstChild as Text,
      from: Number(n.dataset.countFrom ?? 0),
      to: Number(n.dataset.count),
    }));
    const paint = (k: number) => {
      for (const n of nums) n.text.nodeValue = String(Math.round(n.from + (n.to - n.from) * k));
      if (fill.current) fill.current.style.width = `${trackPct(50 + (score - 50) * k)}%`;
    };
    el.dataset.counting = '';
    const start = performance.now();
    let raf = 0;
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / COUNT_MS);
      paint(1 - (1 - t) ** 3);
      if (t < 1) raf = requestAnimationFrame(tick);
      else delete el.dataset.counting;
    };
    tick(start);
    return () => {
      cancelAnimationFrame(raf);
      paint(1);
      delete el.dataset.counting;
    };
  }, [score]);

  return (
    <div className="flex flex-col">
      <section
        ref={panel}
        aria-labelledby={headingId}
        className="relative z-10 rounded-[28px] bg-stats-hero text-stats-hero-ink shadow-stats-hero px-5 pt-5 pb-[18px]"
      >
        <h2 id={headingId} className="text-sm text-stats-hero-soft">הציון במבחן האחרון</h2>

        <p
          className="mt-1.5 text-[clamp(4.75rem,24vw,6.5rem)] font-extrabold leading-[0.95] tracking-[-0.045em] tabular-nums"
          data-metric="headline-score"
          data-count={measured.score}
          data-count-from={50}
        >{measured.score}</p>
        <p className="mt-2 text-base text-stats-hero-soft" data-metric="points-to-target">
          {measured.pointsToTarget > 0
            ? <>עוד <span className="font-bold text-stats-hero-ink tabular-nums">{measured.pointsToTarget}</span> נקודות ל-<bdi dir="ltr" className="font-bold text-stats-gate">{EXEMPTION_SCORE}+</bdi></>
            : <>הגעת ל-<bdi dir="ltr" className="font-bold text-stats-gate">{EXEMPTION_SCORE}+</bdi> במבחן הזה.</>}
        </p>
        <ScoreTrack score={measured.score} best={bestScore} fillRef={fill} />

        <dl className="mt-4 pt-4 border-t border-white/10 flex gap-6">
          <div className="flex flex-col-reverse">
            <dt className="text-[13px] text-stats-hero-soft">מבחנים</dt>
            <dd className="text-xl font-bold tabular-nums" data-metric="exam-count" data-count={examCount} data-count-from={0}>{examCount}</dd>
          </div>
          <div className="flex flex-col-reverse">
            <dt className="text-[13px] text-stats-hero-soft">
              <span aria-hidden className="inline-block size-0 me-1.5 align-[1px] border-x-4 border-x-transparent border-b-[6px] border-b-stats-best" />
              הציון הגבוה
            </dt>
            <dd className="text-xl font-bold tabular-nums" data-metric="best-score" data-count={bestScore} data-count-from={50}>{bestScore}</dd>
          </div>
        </dl>
      </section>

      {weakest && (
        <Link
          href={`/practice?type=${weakest.type}&difficulty=${weakest.level}`}
          className="relative mx-2.5 -mt-[18px] pt-[30px] pb-3.5 px-3.5 flex items-center gap-3 rounded-b-[20px] bg-exam-surface border border-t-0 border-exam-border shadow-surface hover:translate-y-0.5 active:scale-[0.99] transition-transform duration-300 ease-spring-soft"
        >
          <span className="grid place-items-center size-10 flex-none rounded-xl bg-exam-paper-alt text-exam-accent">
            <PenLine className="size-5" aria-hidden />
          </span>
          <span className="min-w-0">
            <span className="block font-bold text-[15px] text-exam-ink">הצעד הבא: {typeLabel(weakest.type)}</span>
            <span className="block text-xs text-exam-ink-soft mt-0.5">ברמה {weakest.level}, סוג השאלה החלש שלך ({windowLabel(recent)})</span>
          </span>
        </Link>
      )}
    </div>
  );
}
