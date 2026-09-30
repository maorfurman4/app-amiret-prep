'use client';

import { useId, useState, type ReactNode } from 'react';
import { ChevronDown, Lightbulb, type LucideIcon } from 'lucide-react';
import { RichText } from '@/components/strategies/RichText';
import { Reveal } from '@/components/strategies/Reveal';
import { toParagraphs } from '@/lib/sentences';

const PROSE_TONE = {
  body: 'text-sm text-exam-ink-soft',
  intro: 'text-sm text-exam-ink',
  muted: 'text-xs text-exam-ink-soft',
} as const;

/** Strategy copy as real paragraphs (two sentences each), bidi-safe via RichText. */
export function Prose({ text, tone = 'body' }: { text: string; tone?: keyof typeof PROSE_TONE }) {
  return (
    <div className="space-y-2">
      {toParagraphs(text).map((p, i) => (
        <p key={i} className={`${PROSE_TONE[tone]} leading-relaxed`}><RichText text={p} /></p>
      ))}
    </div>
  );
}

/**
 * The "bottom line". `text` is always a verbatim sentence from the full text
 * below it. `boxed` (the default) is for a topic's opening; inside a card use
 * the lighter inline form so a page of cards isn't a wall of callouts.
 */
export function KeyLine({ text, label = 'בשורה התחתונה', boxed = true }: { text: string; label?: string; boxed?: boolean }) {
  if (!boxed) {
    return (
      <p className="flex items-start gap-2 text-sm font-semibold text-exam-ink leading-relaxed">
        <Lightbulb className="w-4 h-4 mt-0.5 flex-shrink-0 text-exam-alt" aria-label={label} />
        <span className="min-w-0"><RichText text={text} /></span>
      </p>
    );
  }
  return (
    <div className="flex items-start gap-2.5 rounded-sm border border-exam-alt/40 bg-exam-alt-bg px-3 py-2.5">
      <Lightbulb className="w-4 h-4 mt-0.5 flex-shrink-0 text-exam-alt" aria-hidden />
      <div className="min-w-0">
        <div className="text-[11px] font-bold text-exam-alt mb-0.5">{label}</div>
        <p className="text-sm font-semibold text-exam-ink leading-relaxed"><RichText text={text} /></p>
      </div>
    </div>
  );
}

/** Open/closed state plus the ARIA wiring between a toggle button and its region. */
export function useDisclosure(initial = false) {
  const [open, setOpen] = useState(initial);
  const regionId = useId();
  return {
    open,
    toggle: () => setOpen(o => !o),
    buttonProps: { 'aria-expanded': open, 'aria-controls': regionId },
    regionId,
  };
}

export function DisclosureButton({
  open, onClick, label, openLabel, buttonProps, className = '',
}: {
  open: boolean;
  onClick: () => void;
  label: string;
  openLabel?: string;
  buttonProps: { 'aria-expanded': boolean; 'aria-controls': string };
  className?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      {...buttonProps}
      className={`hit-44 inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-bold text-exam-accent bg-exam-accent/10 hover:bg-exam-accent/15 active:scale-[0.97] transition-[background-color,transform] duration-300 ease-spring ${className}`}
    >
      {open ? (openLabel ?? 'הסתר') : label}
      <ChevronDown className={`w-3.5 h-3.5 transition-transform duration-300 ease-spring ${open ? 'rotate-180' : ''}`} aria-hidden />
    </button>
  );
}

/** A labelled toggle that folds `children` away until asked for. */
export function Expandable({ label, openLabel, children }: { label: string; openLabel?: string; children: ReactNode }) {
  const d = useDisclosure();
  return (
    <div>
      <DisclosureButton open={d.open} onClick={d.toggle} label={label} openLabel={openLabel} buttonProps={d.buttonProps} />
      <Reveal open={d.open} id={d.regionId}>
        <div className="pt-3">{children}</div>
      </Reveal>
    </div>
  );
}

/** A topic's opening: its bottom line up front, the full intro one tap away. */
export function TopicIntro({ keyLine, intro }: { keyLine: string; intro: string }) {
  return (
    <div className="mb-5 space-y-2">
      <KeyLine text={keyLine} />
      <Expandable label="ההסבר המלא" openLabel="הסתר את ההסבר">
        <div className="rounded-md border border-exam-border bg-exam-surface p-4">
          <Prose text={intro} tone="intro" />
        </div>
      </Expandable>
    </div>
  );
}

/** A strategy point: title and bottom line, with the full reasoning folded underneath. */
export function SummaryCard({
  icon: Icon, title, keyLine, body, children,
}: {
  icon: LucideIcon;
  title: string;
  keyLine: string;
  body: string;
  children?: ReactNode;
}) {
  return (
    <article className="rounded-md border border-exam-border bg-exam-surface p-4">
      <h3 className="flex items-start gap-2.5 font-bold text-exam-ink text-[15px] leading-snug mb-3">
        <Icon className="w-5 h-5 mt-0.5 flex-shrink-0 text-exam-ink-soft" strokeWidth={1.75} aria-hidden />
        <span className="min-w-0"><RichText text={title} /></span>
      </h3>
      {children}
      <KeyLine text={keyLine} boxed={false} />
      <div className="mt-2">
        <Expandable label="למה? ההסבר המלא" openLabel="הסתר את ההסבר">
          <Prose text={body} />
        </Expandable>
      </div>
    </article>
  );
}
