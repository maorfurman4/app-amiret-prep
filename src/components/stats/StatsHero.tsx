'use client';

import Link from 'next/link';
import { useId, useState } from 'react';
import { Check, ChevronDown, ChevronLeft } from 'lucide-react';
import { EXEMPTION_SCORE } from '@/lib/calibration';
import { formatProbability } from '@/lib/exemption';
import { currentLabel, typeLabel, windowLabel, type StatsMetrics } from '@/lib/stats-metrics';
import { frequencySentence, ExemptTarget } from '@/components/results/ExemptionCard';
import { Reveal } from '@/components/strategies/Reveal';
import { ScoreTrack } from './ScoreTrack';

const VERDICT = {
  ready: { label: 'מוכנות גבוהה לפי מדדי האתר', cls: 'bg-exam-sage-strong text-on-emerald', desc: 'הביצועים יציבים והרמה המשוערת מעל 134. זו אינה תחזית ציון רשמית.' },
  almost: { label: 'כמעט שם', cls: 'bg-exam-alt text-on-amber', desc: 'הבסיס חזק. עכשיו סגור את הפערים שמסומנים כאן.' },
  not_yet: { label: 'עוד לא, ממשיכים לעבוד', cls: 'bg-exam-paper-alt text-exam-ink', desc: 'תוכנית: סימולציית פרקי הליבה + תרגול חולשה ממוקד כל יום.' },
} as const;

/**
 * The top of /stats: where the student is now (one number — the pooled
 * current level, as a range), how far 134 is, and the single next step.
 * The probability and the readiness checklist are secondary; everything
 * here is read from StatsMetrics, never recomputed.
 */
export function StatsHero({ metrics }: { metrics: StatsMetrics }) {
  const { current, examCount, bestScore, lastScore, bestClassification, weakest, readiness, recent } = metrics;
  const headingId = useId();
  const readinessId = useId();
  const [open, setOpen] = useState(false);
  const verdict = VERDICT[readiness.verdict];

  return (
    <section
      aria-labelledby={headingId}
      className="bg-exam-surface rounded-2xl shadow-raised border border-exam-border dark:border-white/10 p-5 animate-fade-up"
    >
      <h2 id={headingId} className="text-sm text-exam-ink-soft">
        רמה נוכחית משוערת
        {current && <> · לפי {currentLabel(current.used)}</>}
      </h2>

      {current ? (
        <>
          <p className="mt-1 text-4xl font-black text-exam-ink tabular-nums" data-metric="current-range">
            <bdi dir="ltr">{current.lo}–{current.hi}</bdi>
          </p>
          {current.loAtFloor && (
            <p className="mt-1 text-xs text-exam-ink-soft">50 הוא הציון הנמוך ביותר בסקאלה, כך שהרמה עשויה להיות גם מעט מתחתיו.</p>
          )}
          {current.dropped > 0 && (
            <p className="mt-1 text-xs text-exam-ink-soft">לא כללנו מבחנים קודמים שהיו נמוכים בבירור, כי התקדמת מאז.</p>
          )}
          <p className="mt-2 text-sm text-exam-ink-soft" data-metric="points-to-target">
            {current.pointsToTarget > 0
              ? <>חסרות לפחות <span className="font-bold text-exam-ink tabular-nums">{current.pointsToTarget}</span> נקודות כדי להגיע ל-<bdi dir="ltr">{EXEMPTION_SCORE}</bdi>.</>
              : <><bdi dir="ltr">{EXEMPTION_SCORE}</bdi> כבר בתוך הטווח שלך.</>}
          </p>
          <div className="mt-5">
            <ScoreTrack
              lo={current.lo}
              hi={current.hi}
              bandClass="bg-exam-accent"
              markers={[{ score: lastScore, className: 'bg-exam-ink' }, { score: bestScore, className: 'bg-exam-alt' }]}
            />
          </div>
          <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-exam-ink-soft">
            <span className="inline-flex items-center gap-1.5"><span className="size-2.5 rounded-full bg-exam-ink" aria-hidden />המבחן האחרון: <span className="tabular-nums">{lastScore}</span></span>
            <span className="inline-flex items-center gap-1.5"><span className="size-2.5 rounded-full bg-exam-alt" aria-hidden />הגבוה ביותר: <span className="tabular-nums">{bestScore}</span></span>
          </div>
        </>
      ) : (
        <p className="mt-2 text-sm text-exam-ink-soft">עוד אין מספיק נתוני מדידה כדי להעריך רמה. אחרי המבחן הבא יופיע כאן טווח.</p>
      )}

      <dl className="mt-4 grid grid-cols-3 gap-2 text-center">
        {[
          { label: 'מבחנים', value: examCount, metric: 'exam-count' },
          { label: 'הציון הגבוה', value: bestScore, metric: 'best-score' },
          { label: 'המבחן האחרון', value: lastScore, metric: 'last-score' },
        ].map(f => (
          <div key={f.metric} className="bg-exam-paper-alt rounded-xl py-2.5 px-1.5 flex flex-col-reverse">
            <dt className="text-[11px] text-exam-ink-soft">{f.label}</dt>
            <dd className="text-lg font-bold text-exam-ink tabular-nums" data-metric={f.metric}>{f.value}</dd>
          </div>
        ))}
      </dl>

      {current && (
        <p className="mt-4 text-sm text-exam-ink-soft">
          הסיכוי שהרמה שלך כבר <ExemptTarget />:{' '}
          <bdi dir="ltr" className="font-bold text-exam-ink tabular-nums" data-metric="p-exempt">{formatProbability(current.measurement.p)}</bdi>.
          {' '}{frequencySentence(current.measurement.p)}
          {' '}<span className="text-xs">זה אומדן של האתר (דיוק <bdi dir="ltr">±{Math.round(current.measurement.se * 20)}</bdi> נק׳), לא תחזית רשמית של נית&quot;ה.</span>
        </p>
      )}

      {weakest && (
        <Link
          href={`/practice?type=${weakest.type}&difficulty=${weakest.level}`}
          className="mt-4 flex items-center justify-between gap-3 p-4 min-h-14 bg-exam-accent rounded-xl shadow-surface hover:shadow-raised active:shadow-pressed hover:-translate-y-0.5 active:translate-y-0 active:scale-[0.98] transition-[box-shadow,transform] duration-300 ease-spring will-change-transform"
        >
          <span>
            <span className="block text-exam-accent-ink font-bold text-sm">הצעד הבא: {typeLabel(weakest.type)}</span>
            <span className="block text-exam-accent-ink/80 text-xs mt-0.5">
              ברמה {weakest.level} · סוג השאלה החלש שלך ({windowLabel(recent)})
            </span>
          </span>
          <ChevronLeft className="w-5 h-5 text-exam-accent-ink flex-shrink-0" aria-hidden />
        </Link>
      )}

      <button
        type="button"
        aria-expanded={open}
        aria-controls={readinessId}
        onClick={() => setOpen(o => !o)}
        className="mt-3 flex w-full min-h-11 items-center gap-2 rounded-lg text-start text-sm font-medium text-exam-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-exam-accent"
      >
        <span>מדד מוכנות</span>
        <span className={`px-2 py-0.5 rounded-lg text-xs font-bold ${verdict.cls}`}>{verdict.label}</span>
        <ChevronDown className={`ms-auto w-4 h-4 text-exam-ink-soft transition-transform duration-300 motion-reduce:transition-none ${open ? 'rotate-180' : ''}`} aria-hidden />
      </button>
      <Reveal open={open} id={readinessId}>
        <div className="pt-1 pb-1">
          <p className="text-xs text-exam-ink-soft mb-2">{verdict.desc}</p>
          <ul className="space-y-1.5">
            {readiness.reasons.map((r, i) => (
              <li key={i} className="flex items-start gap-2 text-sm">
                <span className={`mt-0.5 ${r.ok ? 'text-exam-sage-strong' : 'text-exam-alt'}`}>
                  {r.ok ? <Check className="w-3.5 h-3.5" strokeWidth={3} aria-label="עומד ביעד" /> : <span aria-label="עוד לא">•</span>}
                </span>
                {r.href
                  ? <Link href={r.href} className="text-exam-ink-soft underline underline-offset-2">{r.text}</Link>
                  : <span className="text-exam-ink-soft">{r.text}</span>}
              </li>
            ))}
          </ul>
          <p className="mt-3 pt-3 border-t border-exam-border text-xs text-exam-ink-soft">
            הציון הגבוה שלך (<span className="tabular-nums">{bestScore}</span>) נמצא ב{bestClassification.label}. כל מוסד קובע בעצמו את הסף לפטור ולכל רמה, זה הטווח הנפוץ ולא תקן אחיד.
          </p>
        </div>
      </Reveal>
    </section>
  );
}
