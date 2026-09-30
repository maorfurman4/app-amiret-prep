'use client';

import { useId, useState } from 'react';
import { AlertTriangle, ChevronDown } from 'lucide-react';
import { DIFFICULTY_BUCKETS, typeLabel, windowLabel, type AccuracyWindow, type DifficultyBucket } from '@/lib/stats-metrics';
import { Reveal } from '@/components/strategies/Reveal';

const DIFFICULTY_LABELS: Record<DifficultyBucket, string> = { easy: 'קל (1–2)', medium: 'בינוני (3)', hard: 'קשה (4–5)' };

/** One colour scale for every accuracy on the page. */
const tone = (pct: number) =>
  pct >= 80
    ? { text: 'text-exam-sage-strong', bar: 'bg-exam-sage-strong', box: 'bg-exam-sage-bg border-exam-sage/40' }
    : pct >= 60
    ? { text: 'text-exam-alt', bar: 'bg-exam-alt', box: 'bg-exam-alt-bg border-exam-alt/40' }
    : { text: 'text-exam-wrong', bar: 'bg-exam-wrong', box: 'bg-exam-wrong-bg border-exam-wrong/40' };

/**
 * The single "performance by question type" view (it replaces the old
 * all-time card and the separate last-10 "weakness analysis", which showed
 * different counts for the same types under near-identical titles). The
 * window is always named; the weakest type is flagged only in the recent
 * window, the one the practice pick uses.
 */
export function TypePerformanceCard({ recent, allTime, weakestType }: {
  recent: AccuracyWindow;
  allTime: AccuracyWindow;
  weakestType: string | null;
}) {
  const [view, setView] = useState<'recent' | 'all'>('recent');
  const [diffOpen, setDiffOpen] = useState(false);
  const diffId = useId();
  const headingId = useId();
  const w = view === 'recent' ? recent : allTime;
  const types = Object.entries(w.byType).filter(([, d]) => d.total > 0);
  const hasDifficulty = DIFFICULTY_BUCKETS.some(b => w.byDifficulty[b].total > 0);

  if (Object.values(allTime.byType).every(d => d.total === 0)) return null;

  return (
    <section aria-labelledby={headingId} className="bg-exam-surface rounded-2xl shadow-surface border border-exam-border p-5 animate-fade-up">
      <h2 id={headingId} className="font-bold text-exam-ink mb-3">ביצועים לפי סוג שאלה</h2>

      {!recent.isAllTime && (
        <div role="group" aria-label="טווח המבחנים" className="inline-flex gap-1 p-1 mb-2 rounded-xl bg-exam-paper-alt">
          {([['recent', windowLabel(recent)], ['all', windowLabel(allTime)]] as const).map(([key, label]) => (
            <button
              key={key}
              type="button"
              aria-pressed={view === key}
              onClick={() => setView(key)}
              className={`min-h-9 px-3 rounded-lg text-xs transition-[background-color,box-shadow] duration-200 focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-exam-accent ${
                view === key ? 'bg-exam-surface text-exam-ink font-semibold shadow-surface' : 'text-exam-ink-soft'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      )}
      <p className="text-xs text-exam-ink-soft mb-3" data-metric="accuracy-window">
        {windowLabel(w)} · רק שאלות שנספרות בציון (בלי הפרק הניסיוני)
      </p>

      <ul className="space-y-2">
        {types.map(([type, d]) => {
          const pct = Math.round((d.correct / d.total) * 100);
          const t = tone(pct);
          const isWeakest = view === 'recent' && weakestType === type;
          return (
            <li
              key={type}
              data-type={type}
              className={`p-3 rounded-xl border ${isWeakest ? 'bg-exam-wrong-bg border-exam-wrong/40' : 'bg-exam-paper-alt border-exam-border'}`}
            >
              <div className="flex items-center justify-between gap-2 mb-2">
                <span className="text-sm font-medium text-exam-ink">
                  {typeLabel(type)}
                  {isWeakest && (
                    <span className="ms-2 text-xs text-exam-wrong font-semibold inline-flex items-center gap-1">
                      <AlertTriangle className="w-3 h-3" aria-hidden />כאן כדאי להתמקד
                    </span>
                  )}
                </span>
                <span className={`text-sm font-bold tabular-nums ${t.text}`} dir="ltr">{pct}%</span>
              </div>
              <div className="h-2 bg-exam-paper rounded-full overflow-hidden" aria-hidden>
                <div className={`h-full rounded-full ${t.bar}`} style={{ width: `${pct}%` }} />
              </div>
              <p className="mt-1 text-xs text-exam-ink-soft tabular-nums" data-metric="type-count">
                {d.correct} נכונות מתוך {d.total}
              </p>
            </li>
          );
        })}
      </ul>

      {hasDifficulty && (
        <>
          <button
            type="button"
            aria-expanded={diffOpen}
            aria-controls={diffId}
            onClick={() => setDiffOpen(o => !o)}
            className="mt-3 flex w-full min-h-11 items-center gap-2 rounded-lg text-start text-sm font-medium text-exam-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-exam-accent"
          >
            פירוט לפי רמת קושי
            <ChevronDown className={`ms-auto w-4 h-4 text-exam-ink-soft transition-transform duration-300 motion-reduce:transition-none ${diffOpen ? 'rotate-180' : ''}`} aria-hidden />
          </button>
          <Reveal open={diffOpen} id={diffId}>
            <p className="text-xs text-exam-ink-soft mb-2">{windowLabel(w)} · לפי הרמה של כל שאלה</p>
            {/* Easy → hard reads left to right, like every scale on the page. */}
            <div dir="ltr" className="grid grid-cols-3 gap-2 pb-1">
              {DIFFICULTY_BUCKETS.map(b => {
                const d = w.byDifficulty[b];
                if (d.total === 0) {
                  return (
                    <div key={b} dir="rtl" className="p-3 rounded-xl border border-dashed border-exam-border text-center text-exam-ink-soft">
                      <div className="text-xl font-bold" aria-hidden>—</div>
                      <div className="text-xs font-semibold mt-0.5">{DIFFICULTY_LABELS[b]}</div>
                      <div className="text-xs mt-0.5">עוד לא הופיעו שאלות ברמה הזו</div>
                    </div>
                  );
                }
                const pct = Math.round((d.correct / d.total) * 100);
                return (
                  <div key={b} dir="rtl" data-difficulty={b} className={`p-3 rounded-xl border text-center ${tone(pct).box} ${tone(pct).text}`}>
                    <div className="text-xl font-bold tabular-nums" dir="ltr">{pct}%</div>
                    <div className="text-xs font-semibold mt-0.5">{DIFFICULTY_LABELS[b]}</div>
                    <div className="text-xs opacity-80 mt-0.5 tabular-nums">{d.correct}/{d.total}</div>
                  </div>
                );
              })}
            </div>
          </Reveal>
        </>
      )}
    </section>
  );
}
