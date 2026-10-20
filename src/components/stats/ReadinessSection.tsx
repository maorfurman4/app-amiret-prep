'use client';

import Link from 'next/link';
import { useId, useState } from 'react';
import { Check, ChevronDown } from 'lucide-react';
import type { StatsMetrics } from '@/lib/stats-metrics';
import { Reveal } from '@/components/strategies/Reveal';

const VERDICT = {
  ready: { label: 'מוכנות גבוהה לפי מדדי האתר', cls: 'bg-exam-sage-strong text-on-emerald', desc: 'הביצועים יציבים והמבחנים האחרונים כולם 134 ומעלה. זו אינה תחזית ציון רשמית.' },
  almost: { label: 'כמעט שם', cls: 'bg-exam-alt text-on-amber', desc: 'הבסיס חזק. עכשיו סגור את הפערים שמסומנים כאן.' },
  not_yet: { label: 'עוד לא, ממשיכים לעבוד', cls: 'bg-exam-paper-alt text-exam-ink', desc: 'תוכנית: סימולציית פרקי הליבה + תרגול חולשה ממוקד כל יום.' },
} as const;

/** The readiness checklist: a plain row with its verdict, opened in place. Read from StatsMetrics only. */
export function ReadinessSection({ metrics }: { metrics: StatsMetrics }) {
  const { readiness, bestScore, bestClassification } = metrics;
  const panelId = useId();
  const [open, setOpen] = useState(false);
  const verdict = VERDICT[readiness.verdict];

  return (
    <section className="border-t border-exam-border pt-1">
      <button
        type="button"
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => setOpen(o => !o)}
        className="flex w-full min-h-12 items-center gap-2 rounded-lg text-start font-bold text-exam-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-exam-accent"
      >
        <span>מדד מוכנות</span>
        <span className={`px-2 py-0.5 rounded-lg text-xs font-bold ${verdict.cls}`}>{verdict.label}</span>
        <ChevronDown className={`ms-auto w-4 h-4 text-exam-ink-soft transition-transform duration-300 motion-reduce:transition-none ${open ? 'rotate-180' : ''}`} aria-hidden />
      </button>
      <Reveal open={open} id={panelId}>
        <div className="pt-1 pb-2">
          <p className="text-xs text-exam-ink-soft mb-2">{verdict.desc}</p>
          <ul className="space-y-1.5">
            {readiness.reasons.map((r, i) => (
              <li key={i} className="flex items-start gap-2 text-sm">
                <span className={`mt-0.5 ${r.ok ? 'text-exam-sage-strong' : 'text-exam-alt'}`}>
                  {r.ok ? <Check className="w-3.5 h-3.5" strokeWidth={3} aria-label="עומד ביעד" /> : <span role="img" aria-label="עוד לא">•</span>}
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
