'use client';

import { useId, useState, type ReactNode } from 'react';
import { ChevronDown, Lightbulb, Check, X } from 'lucide-react';
import { RichText } from '@/components/strategies/RichText';
import type { LayeredRule, MinimalPair } from '@/data/strategies';

type Depth = 1 | 2 | 3;
type Tone = 'source' | 'correct' | 'trap';

const NEXT_LABEL: Record<Depth, string> = {
  1: 'למה זה עובד?',
  2: 'הראה דוגמה',
  3: 'הסתר',
};

const ROW: Record<Tone, { label: string; box: string; mark: string; icon?: ReactNode }> = {
  source: {
    label: 'מקור',
    box: 'border-exam-border bg-exam-paper-alt',
    mark: 'bg-exam-accent/15 text-exam-accent ring-exam-accent/30',
  },
  correct: {
    label: 'ניסוח נכון',
    box: 'border-exam-sage/40 bg-exam-sage-bg',
    mark: 'bg-exam-sage/20 text-exam-sage-strong ring-exam-sage/50',
    icon: <Check className="w-3.5 h-3.5" strokeWidth={3} aria-hidden />,
  },
  trap: {
    label: 'מסיח',
    box: 'border-exam-wrong/40 bg-exam-wrong-bg',
    mark: 'bg-exam-wrong/15 text-exam-wrong ring-exam-wrong/50',
    icon: <X className="w-3.5 h-3.5" strokeWidth={3} aria-hidden />,
  },
};

/** Wraps each authored phrase (first occurrence, non-overlapping) in a <mark>. */
function withHighlights(text: string, phrases: string[], markClass: string): ReactNode[] {
  const ranges = phrases
    .map(p => ({ start: text.indexOf(p), end: text.indexOf(p) + p.length }))
    .filter(r => r.start >= 0)
    .sort((a, b) => a.start - b.start)
    .filter((r, i, all) => i === 0 || r.start >= all[i - 1].end);

  const out: ReactNode[] = [];
  let at = 0;
  for (const r of ranges) {
    if (r.start > at) out.push(text.slice(at, r.start));
    out.push(
      <mark key={r.start} className={`rounded px-0.5 font-semibold ring-1 ${markClass}`}>
        {text.slice(r.start, r.end)}
      </mark>,
    );
    at = r.end;
  }
  if (at < text.length) out.push(text.slice(at));
  return out;
}

/** A layer that slides open (grid-rows 0fr → 1fr) and is inert while closed. */
function Reveal({ open, id, children }: { open: boolean; id: string; children: ReactNode }) {
  return (
    <div
      id={id}
      inert={!open}
      className={`grid transition-[grid-template-rows,opacity] duration-500 ease-spring-soft motion-reduce:transition-none ${
        open ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0'
      }`}
    >
      <div className="overflow-hidden">{children}</div>
    </div>
  );
}

function PairView({ pair }: { pair: MinimalPair }) {
  const rows: { tone: Tone; text: string; phrases: string[] }[] = [
    { tone: 'source', text: pair.source, phrases: pair.highlight.source },
    { tone: 'correct', text: pair.correct, phrases: pair.highlight.correct },
    { tone: 'trap', text: pair.trap, phrases: pair.highlight.trap },
  ];
  return (
    <div className="space-y-2">
      {rows.map(({ tone, text, phrases }) => (
        <div key={tone} className={`rounded-xl border px-3 py-2.5 ${ROW[tone].box}`}>
          <div className="flex items-center gap-1 text-[11px] font-bold text-exam-ink-soft mb-1">
            {ROW[tone].icon}
            {ROW[tone].label}
          </div>
          <p dir="ltr" className="font-serif text-[15px] leading-relaxed text-exam-ink text-left">
            {withHighlights(text, phrases, ROW[tone].mark)}
          </p>
        </div>
      ))}
      <p className="flex items-start gap-2 pt-1 text-sm text-exam-ink leading-relaxed">
        <Lightbulb className="w-4 h-4 mt-0.5 flex-shrink-0 text-exam-alt" aria-hidden />
        <span><RichText text={pair.note} /></span>
      </p>
    </div>
  );
}

/**
 * One LayeredRule with progressive disclosure: the rule alone by default;
 * each tap on the action reveals the next layer (why → example), and the
 * last tap folds it back to the rule.
 */
export function ProgressiveRuleCard({ rule, index }: { rule: LayeredRule; index?: number }) {
  const [depth, setDepth] = useState<Depth>(1);
  const baseId = useId();
  const whyId = `${baseId}-why`;
  const exampleId = `${baseId}-example`;

  const advance = () => setDepth(d => (d === 3 ? 1 : ((d + 1) as Depth)));

  return (
    <article
      className={`rounded-2xl border bg-exam-surface p-4 transition-[box-shadow,border-color] duration-300 ease-spring ${
        depth > 1 ? 'border-exam-border-strong shadow-raised' : 'border-exam-border shadow-surface'
      }`}
    >
      <header className="flex items-start gap-3">
        {index !== undefined && (
          <span className="w-7 h-7 rounded-full bg-exam-accent text-exam-accent-ink text-xs font-bold flex items-center justify-center flex-shrink-0">
            {index}
          </span>
        )}
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-2 mb-1">
            <span className="text-xs font-bold text-exam-accent">{rule.title}</span>
            <span className="flex gap-1" aria-label={`שכבה ${depth} מתוך 3`} role="img">
              {[1, 2, 3].map(l => (
                <span
                  key={l}
                  className={`h-1.5 rounded-full transition-[width,background-color] duration-300 ease-spring ${
                    l <= depth ? 'w-4 bg-exam-accent' : 'w-1.5 bg-exam-border'
                  }`}
                />
              ))}
            </span>
          </div>
          <p className="text-[15px] font-bold text-exam-ink leading-snug"><RichText text={rule.rule} /></p>
        </div>
      </header>

      <Reveal open={depth >= 2} id={whyId}>
        <div className="pt-3 mt-3 border-t border-exam-border">
          <div className="text-[11px] font-bold text-exam-ink-soft mb-1">למה</div>
          <p className="text-sm text-exam-ink-soft leading-relaxed"><RichText text={rule.why} /></p>
          {rule.source && <p className="mt-1.5 text-[11px] text-exam-ink-soft/80" dir="ltr">{rule.source}</p>}
        </div>
      </Reveal>

      <Reveal open={depth >= 3} id={exampleId}>
        <div className="pt-3">
          <div className="text-[11px] font-bold text-exam-ink-soft mb-2">דוגמה</div>
          {rule.example.kind === 'pair' ? (
            <PairView pair={rule.example} />
          ) : (
            <p className="rounded-xl bg-exam-paper-alt border border-exam-border px-3 py-2.5 text-sm text-exam-ink leading-relaxed">
              <RichText text={rule.example.text} />
            </p>
          )}
        </div>
      </Reveal>

      <button
        type="button"
        onClick={advance}
        aria-expanded={depth > 1}
        aria-controls={depth === 1 ? whyId : `${whyId} ${exampleId}`}
        className="hit-44 mt-3 inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-bold text-exam-accent bg-exam-accent/10 hover:bg-exam-accent/15 active:scale-[0.97] transition-[background-color,transform] duration-300 ease-spring"
      >
        {NEXT_LABEL[depth]}
        <ChevronDown
          className={`w-3.5 h-3.5 transition-transform duration-300 ease-spring ${depth === 3 ? 'rotate-180' : ''}`}
          aria-hidden
        />
      </button>
    </article>
  );
}
