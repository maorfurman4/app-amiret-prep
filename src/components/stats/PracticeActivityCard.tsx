import type { PracticeActivity } from '@/lib/practice-activity';

/**
 * Practice the exam count doesn't show: how many questions the student has
 * answered outside full simulations, and on how many distinct days. A plain
 * surface card, placed under the hero beside the exam summary.
 */
export function PracticeActivityCard({ practice }: { practice: PracticeActivity }) {
  return (
    <section
      aria-label="פעילות תרגול"
      className="bg-exam-surface border border-exam-border rounded-2xl shadow-surface px-5 py-4"
    >
      <dl className="flex gap-6">
        <div className="flex flex-col-reverse">
          <dt className="text-[13px] text-exam-ink-soft">שאלות שתרגלת</dt>
          <dd className="text-xl font-bold tabular-nums text-exam-ink">{practice.questions}</dd>
        </div>
        <div className="flex flex-col-reverse">
          <dt className="text-[13px] text-exam-ink-soft">ימים שתרגלת</dt>
          <dd className="text-xl font-bold tabular-nums text-exam-ink">{practice.days}</dd>
        </div>
      </dl>
    </section>
  );
}
