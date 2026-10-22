'use client';

import { useEffect, useRef, useState } from 'react';
import { DayPicker, type ChevronProps } from 'react-day-picker';
import { he } from 'react-day-picker/locale';
import { ChevronLeft, ChevronRight } from 'lucide-react';

/** Month chips shown above the grid: this month and the next 11. */
const CHIP_MONTHS = 12;

// YYYY-MM-DD <-> a local-midnight Date. Symmetric, so the stored day never shifts.
export const toDate = (s: string) => { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d); };
export const toDateStr = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const monthStart = (d: Date) => new Date(d.getFullYear(), d.getMonth(), 1);
const addMonths = (d: Date, n: number) => new Date(d.getFullYear(), d.getMonth() + n, 1);
const sameMonth = (a: Date, b: Date) => a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth();

const monthName = new Intl.DateTimeFormat('he-IL', { month: 'long' });

/** The nav sits in RTL order (previous on the right), so each chevron points outward. */
function Chevron({ orientation, className }: ChevronProps) {
  const Icon = orientation === 'left' ? ChevronRight : ChevronLeft;
  return <Icon className={className} aria-hidden />;
}

const DAY_BUTTON = 'mx-auto grid place-items-center size-11 rounded-xl text-[15px] font-semibold tabular-nums text-exam-ink hover:bg-exam-paper-alt focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-exam-accent active:scale-[0.94] transition-[background-color,transform] duration-200 ease-spring motion-reduce:transition-none';
const NAV_BUTTON = 'hit-44 grid place-items-center size-9 rounded-xl text-exam-ink-soft hover:text-exam-ink hover:bg-exam-paper-alt focus-visible:outline-2 focus-visible:outline-exam-accent aria-disabled:opacity-30 aria-disabled:pointer-events-none';

/**
 * Inline RTL Hebrew month calendar (react-day-picker, MIT): Sunday-first,
 * Hebrew month and weekday names, arrow keys that follow the RTL layout.
 * A row of month chips reaches a date months out in one tap, which a
 * month-by-month arrow (or the native wheel) makes slow on a phone.
 */
export function ExamDatePicker({ value, min, max, onChange, labelledBy }: {
  value: string;
  min: string;
  max: string;
  onChange: (value: string) => void;
  labelledBy: string;
}) {
  const first = toDate(min);
  const last = toDate(max);
  const [month, setMonth] = useState(() => monthStart(value ? toDate(value) : first));
  const chips = useRef<HTMLDivElement>(null);
  const chipMonths = Array.from({ length: CHIP_MONTHS }, (_, i) => addMonths(first, i)).filter(m => m <= last);

  // Keep the active chip in view when the arrows move past the visible ones.
  useEffect(() => {
    const active = chips.current?.querySelector<HTMLElement>('[aria-pressed="true"]');
    const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
    active?.scrollIntoView({ block: 'nearest', inline: 'nearest', behavior: reduce ? 'auto' : 'smooth' });
  }, [month]);

  return (
    <div className="space-y-2.5">
      <div
        ref={chips}
        role="group"
        aria-label="מעבר מהיר לחודש"
        className="-mx-4 px-4 flex gap-1.5 overflow-x-auto overscroll-x-contain snap-x [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        {chipMonths.map(m => {
          const on = sameMonth(m, month);
          return (
            <button
              key={m.getTime()}
              type="button"
              aria-pressed={on}
              onClick={() => setMonth(m)}
              className={`snap-start shrink-0 h-9 px-3.5 rounded-full border text-[13px] font-semibold whitespace-nowrap focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-exam-accent active:scale-[0.96] transition-[background-color,border-color,transform] duration-200 ease-spring motion-reduce:transition-none ${on ? 'bg-exam-accent border-exam-accent text-exam-accent-ink' : 'bg-exam-surface border-exam-border-input text-exam-ink hover:bg-exam-paper-alt'}`}
            >
              {monthName.format(m)}{m.getFullYear() !== first.getFullYear() && ` ${m.getFullYear()}`}
            </button>
          );
        })}
      </div>

      <DayPicker
        mode="single"
        required
        autoFocus
        dir="rtl"
        locale={he}
        weekStartsOn={0}
        today={first}
        month={month}
        onMonthChange={setMonth}
        startMonth={first}
        endMonth={last}
        disabled={[{ before: first }, { after: last }]}
        selected={value ? toDate(value) : undefined}
        onSelect={d => onChange(toDateStr(d))}
        aria-labelledby={labelledBy}
        components={{ Chevron }}
        classNames={{
          root: 'relative',
          months: '',
          month: '',
          month_caption: 'h-9 grid place-items-center',
          caption_label: 'text-base font-extrabold tracking-[-0.01em] text-exam-ink',
          nav: 'absolute inset-x-0 top-0 h-9 flex items-center justify-between',
          button_previous: NAV_BUTTON,
          button_next: NAV_BUTTON,
          chevron: 'size-5',
          month_grid: 'mt-1.5 w-full border-collapse',
          weekdays: '',
          weekday: 'h-7 text-xs font-medium text-exam-ink-soft',
          week: '',
          day: 'p-0 text-center',
          day_button: DAY_BUTTON,
          today: '[&>button]:ring-1 [&>button]:ring-inset [&>button]:ring-exam-accent',
          selected: '[&>button]:bg-exam-accent [&>button]:text-exam-accent-ink [&>button]:font-extrabold [&>button]:ring-0 [&>button:hover]:bg-exam-accent',
          disabled: '[&>button]:text-exam-ink-soft [&>button]:opacity-40 [&>button]:pointer-events-none',
          outside: 'invisible',
          hidden: 'invisible',
        }}
      />
    </div>
  );
}
