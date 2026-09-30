import { SECTION_CONFIGS } from '@/types/exam';
import { GUIDE_ID_BY_QUESTION_TYPE, type TimeBudgetRow } from '@/data/strategies';

/** "4 דק׳" for whole minutes, "90 שנ׳" otherwise. */
export function formatSec(sec: number): string {
  return sec % 60 === 0 ? `${sec / 60} דק׳` : `${sec} שנ׳`;
}

/**
 * The section's time budget as proportions: reading, one slot per question,
 * and whatever is left as slack. Section length and question count come from
 * the exam config; the per-question plan from TIME_BUDGET.
 */
export function sectionSplit(row: TimeBudgetRow) {
  const cfg = SECTION_CONFIGS.find(c => GUIDE_ID_BY_QUESTION_TYPE[c.type] === row.id);
  if (!cfg) return null;
  const { durationSeconds: total, questionCount: count } = cfg;
  const { readingSec, perQuestionSec, stuckCapSec } = row.plan;
  const slack = Math.max(0, total - readingSec - count * perQuestionSec);
  return { total, count, readingSec, perQuestionSec, stuckCapSec, slack };
}

export function TimeBar({ row }: { row: TimeBudgetRow }) {
  const split = sectionSplit(row);
  if (!split) return null;
  const { total, count, readingSec, perQuestionSec, stuckCapSec, slack } = split;
  const pct = (sec: number) => `${(sec / total) * 100}%`;
  const summary = [
    readingSec > 0 && `קריאה ${formatSec(readingSec)}`,
    `${count} שאלות × ${formatSec(perQuestionSec)}`,
    slack > 0 && `מרווח ${formatSec(slack)}`,
  ].filter(Boolean).join(', ');

  return (
    <div className="space-y-3">
      <div>
        <div className="flex items-baseline justify-between text-[11px] text-exam-ink-soft mb-1">
          <span>חלוקת הפרק</span>
          <span>{formatSec(total)}</span>
        </div>
        <div role="img" aria-label={`חלוקת ${formatSec(total)}: ${summary}`} className="flex h-7 gap-0.5 overflow-hidden rounded-sm">
          {readingSec > 0 && (
            <div style={{ flexBasis: pct(readingSec) }} className="flex items-center justify-center bg-exam-accent text-[11px] font-bold text-exam-accent-ink">קריאה</div>
          )}
          {Array.from({ length: count }, (_, i) => (
            <div key={i} style={{ flexBasis: pct(perQuestionSec) }} className="flex items-center justify-center bg-exam-sage-bg text-[11px] font-bold text-exam-sage-strong border border-exam-sage/40 rounded-[2px]">
              {i + 1}
            </div>
          ))}
          {slack > 0 && <div style={{ flexBasis: pct(slack) }} className="bg-exam-paper-alt" />}
        </div>
        <div aria-hidden className="mt-1.5 flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-exam-ink-soft">
          {readingSec > 0 && <span className="inline-flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-exam-accent" />קריאה {formatSec(readingSec)}</span>}
          <span className="inline-flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-exam-sage" />{count} × {formatSec(perQuestionSec)}</span>
          {slack > 0 && <span className="inline-flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-exam-border-strong" />מרווח {formatSec(slack)}</span>}
        </div>
      </div>

      <div>
        <div className="text-[11px] text-exam-ink-soft mb-1">שאלה אחת</div>
        <div
          role="img"
          aria-label={`זמן לשאלה ${row.perQ}, מקסימום תקיעה ${row.stuckCap}`}
          className="flex h-5 gap-0.5 overflow-hidden rounded-sm"
        >
          <div style={{ flexBasis: `${(perQuestionSec / stuckCapSec) * 100}%` }} className="bg-exam-sage/70" />
          <div style={{ flexBasis: `${((stuckCapSec - perQuestionSec) / stuckCapSec) * 100}%` }} className="bg-exam-alt/70" />
        </div>
        <div className="mt-1.5 grid grid-cols-2 gap-2">
          <div className="rounded-sm bg-exam-paper-alt px-3 py-2">
            <div className="text-[11px] text-exam-ink-soft">זמן לשאלה</div>
            <div className="text-sm font-bold text-exam-ink">{row.perQ}</div>
          </div>
          <div className="rounded-sm bg-exam-alt-bg px-3 py-2">
            <div className="text-[11px] text-exam-alt">מקסימום תקיעה</div>
            <div className="text-sm font-bold text-exam-alt">{row.stuckCap}</div>
          </div>
        </div>
      </div>
    </div>
  );
}
