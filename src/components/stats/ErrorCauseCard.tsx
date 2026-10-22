import { useId } from 'react';
import { ERROR_CAUSE_LABEL, type ErrorCause } from '@/lib/error-cause';
import type { ErrorCauseBreakdown } from '@/lib/practice-activity';

/** One plain-language line per top cause — what the biggest gap actually is. */
const CAUSE_INSIGHT: Record<ErrorCause, string> = {
  vocab: 'רוב הטעויות שתייגת הן מילים לא מוכרות.',
  logic: 'רוב הטעויות שתייגת הן בהיגיון של השאלה.',
  time: 'רוב הטעויות שתייגת קרו תחת לחץ זמן.',
  careless: 'רוב הטעויות שתייגת הן פספוסים — ידעת, אבל סימנת אחרת.',
};

/**
 * Why wrong answers go wrong, from what the student tagged in "מה קרה כאן?".
 * Reads directly adjacent to חוזקות וחולשות as one weakness story. Tagging is
 * optional and often sparse, so below ERROR_CAUSE_MIN tags it nudges instead
 * of drawing a chart from one or two points.
 */
export function ErrorCauseCard({ breakdown }: { breakdown: ErrorCauseBreakdown }) {
  const headingId = useId();

  if (!breakdown.enough) {
    return (
      <section aria-labelledby={headingId} className="bg-exam-paper-alt rounded-[20px] shadow-pressed px-4 py-[18px]">
        <h2 id={headingId} className="text-lg font-bold text-exam-ink mb-2">למה אתה טועה</h2>
        <p className="text-sm text-exam-ink-soft">
          תייג טעויות ב״מה קרה כאן?״ כדי לראות למה בדיוק אתה נופל — אחרי כמה תיוגים תופיע כאן התמונה.
        </p>
      </section>
    );
  }

  const top = breakdown.top!;
  return (
    <section aria-labelledby={headingId} className="bg-exam-paper-alt rounded-[20px] shadow-pressed px-4 py-[18px]">
      <h2 id={headingId} className="text-lg font-bold text-exam-ink mb-1">למה אתה טועה</h2>
      <p className="text-xs text-exam-ink-soft mb-4">לפי {breakdown.total} הטעויות שתייגת</p>

      <ul className="space-y-4">
        {breakdown.slices.map(s => {
          const pct = Math.round(s.share * 100);
          return (
            <li key={s.cause} data-cause={s.cause}>
              <div className="flex items-baseline justify-between gap-2">
                <span className="text-[15px] font-semibold text-exam-ink">{ERROR_CAUSE_LABEL[s.cause]}</span>
                <span className="text-[22px] font-extrabold tracking-[-0.02em] tabular-nums text-exam-ink" dir="ltr">{pct}%</span>
              </div>
              <div className="relative h-2 mt-1.5 rounded-full bg-exam-paper" dir="ltr" aria-hidden>
                <div className="absolute inset-y-0 left-0 rounded-full bg-exam-accent transition-[width] duration-500 ease-spring-soft motion-reduce:transition-none" style={{ width: `${pct}%` }} />
              </div>
              <p className="mt-1 text-xs text-exam-ink-soft tabular-nums">{s.count} מתוך {breakdown.total}</p>
            </li>
          );
        })}
      </ul>

      <p className="mt-4 pt-3 border-t border-exam-border text-sm text-exam-ink">
        הפער הכי גדול שלך: <span className="font-bold">{ERROR_CAUSE_LABEL[top]}</span> — {CAUSE_INSIGHT[top]}
      </p>
    </section>
  );
}
