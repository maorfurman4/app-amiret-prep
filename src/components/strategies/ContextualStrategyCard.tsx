import Link from 'next/link';
import { Sparkles, LifeBuoy, ChevronLeft } from 'lucide-react';
import type { ContextualTip } from '@/lib/strategy-tip';
import { RichText } from '@/components/strategies/RichText';
import { heCount } from '@/lib/hebrew-count';

const TONE: Record<'blue' | 'purple' | 'green', { badge: string; glow: string; icon: string }> = {
  blue: { badge: 'bg-exam-accent/10 text-exam-accent', glow: 'from-exam-accent/25', icon: 'text-exam-accent' },
  purple: { badge: 'bg-exam-alt-bg text-exam-alt', glow: 'from-exam-alt/25', icon: 'text-exam-alt' },
  green: { badge: 'bg-exam-sage-bg text-exam-sage-strong', glow: 'from-exam-sage/25', icon: 'text-exam-sage-strong' },
};

/**
 * Post-practice "Pro Tip": one step of the rescue protocol for the question
 * type this session exposed as weakest (see pickContextualTip), and a link
 * to the full method.
 */
export function ContextualStrategyCard({ tip: { guide, tip, errors, total } }: { tip: ContextualTip }) {
  const tone = TONE[guide.color];
  const kind = `מסוג ${guide.titleHe}`;
  const missed = total === 1
    ? `טעית בשאלה ${kind} בתרגול הזה.`
    : errors === total
      ? `טעית ב${total === 2 ? 'שתי' : `כל ${total}`} השאלות ${kind} בתרגול הזה.`
      : errors === 1
        ? `טעית בשאלה אחת מתוך ${heCount(total, 'question')} ${kind} בתרגול הזה.`
        : `טעית ב-${errors} מתוך ${total} שאלות ${kind} בתרגול הזה.`;
  const reason = errors > 0
    ? `${missed} הכלי הזה יעזור לך שם יותר מכל דבר אחר.`
    : `ענית נכון על ${total === 1 ? `השאלה ${kind}` : `כל השאלות ${kind}`}. הכלי הזה יעזור לך לשמור על זה גם כשהשאלות יהיו קשות יותר.`;

  return (
    <section
      aria-labelledby="pro-tip-title"
      className="relative overflow-hidden rounded-2xl border border-exam-border bg-exam-surface text-right shadow-raised hover:shadow-overlay hover:-translate-y-0.5 transition-[box-shadow,transform] duration-500 ease-spring animate-fade-up"
    >
      <div aria-hidden className={`pointer-events-none absolute -top-24 -left-24 h-56 w-56 rounded-full bg-radial ${tone.glow} to-transparent to-70% blur-2xl`} />

      <div className="relative p-5">
        <div className="flex items-center justify-between gap-3 mb-3">
          <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-bold ${tone.badge}`}>
            <Sparkles className="w-3.5 h-3.5 animate-check-pop" strokeWidth={2} aria-hidden />
            Pro Tip
          </span>
          <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-exam-ink-soft">
            <guide.icon className="w-3.5 h-3.5" strokeWidth={1.75} aria-hidden />
            {guide.titleHe}
          </span>
        </div>

        <p className="text-xs text-exam-ink-soft leading-relaxed mb-4">{reason}</p>

        <h3 id="pro-tip-title" className="flex items-start gap-2 font-bold text-exam-ink text-base leading-snug mb-1.5">
          <LifeBuoy className={`w-4.5 h-4.5 mt-0.5 flex-shrink-0 ${tone.icon}`} strokeWidth={1.75} aria-hidden />
          <span><RichText text={tip.step} /></span>
        </h3>
        <p className="text-sm text-exam-ink-soft leading-relaxed mb-5"><RichText text={tip.detail} /></p>

        <Link
          href={guide.tipsHref}
          className="flex w-full items-center justify-center gap-1.5 rounded-xl border border-exam-border bg-exam-paper-alt py-2.5 text-sm font-bold text-exam-ink shadow-surface hover:shadow-raised hover:-translate-y-0.5 active:translate-y-0 active:shadow-pressed active:scale-[0.98] transition-[box-shadow,transform] duration-300 ease-spring"
        >
          לשיטה המלאה של {guide.titleHe}
          <ChevronLeft className="w-4 h-4" aria-hidden />
        </Link>
      </div>
    </section>
  );
}
