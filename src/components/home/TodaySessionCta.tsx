'use client';

import Link from 'next/link';
import { useLayoutEffect, useRef, type ReactNode } from 'react';
import { Check, Sparkles } from 'lucide-react';
import { useDashboardSummary } from '@/lib/dashboard-context';
import { typeLabel } from '@/lib/stats-metrics';
import { heCount } from '@/lib/hebrew-count';
import type { Rings } from '@/lib/rings';
import type { TodayActivity } from '@/lib/today-activity';
import { ReviewDueNudge } from './ReviewDueNudge';

const COUNT_MS = 900;

/**
 * The home page's "Today" card, in two parts: what the student did today
 * (answers, accuracy, minutes and accuracy per question type, all from the
 * responses log) and what's left of today's plan (the server-derived
 * learning goals, src/lib/rings.ts), then the CTA to /today. Until the
 * summary loads it is just the CTA, the dashboard's no-skeleton contract.
 */
export function TodaySessionCta() {
  const { data } = useDashboardSummary();
  const due = data?.todayDueCount ?? 0;
  const panel = useRef<HTMLDivElement>(null);
  const answered = data?.today.answered ?? 0;

  /**
   * The page's one load moment: today's numbers count up from 0 while the
   * accuracy bars grow (CSS, .today-bar). The markup always holds the final
   * values, so screen readers and reduced motion get them as is.
   */
  useLayoutEffect(() => {
    const el = panel.current;
    if (!el || !answered || matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    // Write into React's own text node, so a later render still finds it.
    const nums = [...el.querySelectorAll<HTMLElement>('[data-count]')].map(n => ({ text: n.firstChild as Text, to: Number(n.dataset.count) }));
    const paint = (k: number) => { for (const n of nums) n.text.nodeValue = String(Math.round(n.to * k)); };
    const start = performance.now();
    let raf = 0;
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / COUNT_MS);
      paint(1 - (1 - t) ** 3);
      if (t < 1) raf = requestAnimationFrame(tick);
    };
    tick(start);
    return () => { cancelAnimationFrame(raf); paint(1); };
  }, [answered]);

  return (
    <div ref={panel} className="w-full p-4 bg-exam-sage-bg border border-exam-sage/20 rounded-3xl shadow-raised">
      {data && (
        <>
          {answered > 0 ? <DoneToday today={data.today} /> : (
            <p className="text-center text-sm text-exam-ink-soft">
              <span className="block text-base font-extrabold text-exam-ink">עוד לא ענית על שאלות היום</span>
              כל שאלה שתענה עליה, בתרגול או במבחן, תופיע כאן.
            </p>
          )}
          <h3 className="mt-4 mb-2 px-0.5 text-[13px] font-bold text-exam-ink">מה נשאר מהתוכנית של היום</h3>
          <PlanLeft rings={data.rings} />
        </>
      )}
      <Link
        href="/today"
        className={`relative w-full h-[52px] ${data ? 'mt-3.5' : ''} flex items-center justify-center gap-2 rounded-2xl bg-exam-surface shadow-surface text-[17px] font-extrabold text-exam-sage-strong hover:shadow-raised active:scale-[0.98] transition-[box-shadow,transform] duration-300 ease-spring will-change-transform`}
      >
        <Sparkles className="w-5 h-5" aria-hidden />
        התרגול היומי שלי
        {due > 0 && (
          <span className="absolute left-3 min-w-[22px] h-[22px] px-1.5 flex items-center justify-center rounded-full bg-exam-sage-strong text-on-emerald text-xs font-extrabold animate-check-pop">
            {due > 99 ? '99+' : due}
          </span>
        )}
      </Link>
      {data && due > 0 && <div className="mt-2.5 px-1.5"><ReviewDueNudge dueCount={due} /></div>}
    </div>
  );
}

function DoneToday({ today }: { today: TodayActivity }) {
  const accuracy = Math.round((today.correct / today.answered) * 100);
  const minutes = Math.round(today.timeMs / 60_000);
  return (
    <>
      <dl className="grid grid-cols-3 text-center [&>div+div]:border-s [&>div+div]:border-exam-sage/20">
        <Kpi label="שאלות היום"><span data-count={today.answered}>{today.answered}</span></Kpi>
        <Kpi label="הצלחה"><span data-count={accuracy}>{accuracy}</span>%</Kpi>
        <Kpi label="דקות תרגול">{minutes > 0 ? <span data-count={minutes}>{minutes}</span> : '<1'}</Kpi>
      </dl>
      <h3 className="mt-4 mb-2 px-0.5 text-[13px] font-bold text-exam-ink">לפי סוג שאלה</h3>
      <ul className="flex flex-col gap-2.5">
        {today.byType.map(t => {
          const pct = Math.round((t.correct / t.answered) * 100);
          return (
            <li key={t.type} className="grid grid-cols-[1fr_auto] items-center gap-x-2.5 gap-y-1">
              <span className="text-[13.5px] font-bold text-exam-ink">{typeLabel(t.type)}</span>
              <span className="row-span-2 text-[13.5px] font-extrabold tabular-nums text-exam-ink" dir="ltr">{pct}%</span>
              <span className="text-xs text-exam-ink-soft">
                {heCount(t.answered, 'question')}, {t.minLevel === t.maxLevel ? <>רמה {t.minLevel}</> : <>רמות <bdi dir="ltr">{t.minLevel}–{t.maxLevel}</bdi></>}
              </span>
              <span className="col-span-2 h-1.5 rounded-full bg-exam-sage/15 overflow-hidden" aria-hidden>
                <span className="today-bar block h-full rounded-full bg-exam-sage" style={{ width: `${pct}%` }} />
              </span>
            </li>
          );
        })}
      </ul>
    </>
  );
}

function Kpi({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex flex-col-reverse">
      <dt className="text-[12.5px] text-exam-ink-soft">{label}</dt>
      <dd className="text-[26px] leading-[1.15] font-extrabold tracking-[-0.03em] tabular-nums text-exam-ink" dir="ltr">{children}</dd>
    </div>
  );
}

function PlanLeft({ rings }: { rings: Rings }) {
  const { effort, retention, simulation } = rings;
  return (
    <ul className="flex flex-col gap-2.5 p-3 bg-exam-surface rounded-2xl shadow-surface text-[13.5px] text-exam-ink-soft">
      <PlanItem done={effort.done >= effort.target} value={<bdi dir="ltr">{effort.done}/{effort.target}</bdi>}>
        <b className="font-bold text-exam-ink">שאלות ברמה המאתגרת</b> בשבילך
      </PlanItem>
      <PlanItem
        done={retention.due === 0}
        value={retention.due > 0 && <bdi dir="ltr">{retention.done}/{retention.done + retention.due}</bdi>}
      >
        <b className="font-bold text-exam-ink">חזרות בזמן</b>{' '}
        {retention.due > 0
          ? `(עוד ${retention.due === 1 ? 'אחת ממתינה' : `${retention.due} ממתינות`})`
          : retention.done > 0 ? `(סיימת ${retention.done})` : '(אין להיום)'}
      </PlanItem>
      <PlanItem
        done={simulation.done}
        value={<span className={`font-semibold ${simulation.done ? 'text-exam-sage-strong' : 'text-exam-ink-soft'}`}>{simulation.done ? 'עשית השבוע' : 'עוד לא השבוע'}</span>}
      >
        <b className="font-bold text-exam-ink">סימולציה שבועית</b>
      </PlanItem>
    </ul>
  );
}

function PlanItem({ done, value, children }: { done: boolean; value: ReactNode; children: ReactNode }) {
  return (
    <li className="flex items-center gap-2.5">
      <span
        role="img"
        aria-label={done ? 'הושלם' : 'עוד לא'}
        className={`grid place-items-center size-5 shrink-0 rounded-full ${done ? 'bg-exam-sage-strong text-exam-surface' : 'border-2 border-exam-border'}`}
      >
        {done && <Check className="size-3" strokeWidth={3.5} aria-hidden />}
      </span>
      <span className="min-w-0">{children}</span>
      {value && <span className="ms-auto font-extrabold tabular-nums text-exam-ink">{value}</span>}
    </li>
  );
}
