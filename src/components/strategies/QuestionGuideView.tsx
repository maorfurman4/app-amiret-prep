'use client';

import Link from 'next/link';
import { Compass, LifeBuoy, NotebookPen, Check, ChevronLeft, ChevronDown } from 'lucide-react';
import { RichText } from '@/components/strategies/RichText';
import { Reveal } from '@/components/strategies/Reveal';
import { DisclosureButton, TopicIntro, useDisclosure } from '@/components/strategies/GuideBlocks';
import type { QuestionGuide } from '@/data/strategies';

export const GUIDE_TONE: Record<QuestionGuide['color'], { badge: string; heading: string; step: string; rail: string }> = {
  blue: { badge: 'bg-exam-accent/10 text-exam-accent', heading: 'text-exam-accent', step: 'bg-exam-accent text-exam-accent-ink', rail: 'bg-exam-accent/30' },
  purple: { badge: 'bg-exam-alt-bg text-exam-alt', heading: 'text-exam-alt', step: 'bg-exam-alt text-on-amber', rail: 'bg-exam-alt/40' },
  green: { badge: 'bg-exam-sage-bg text-exam-sage-strong', heading: 'text-exam-sage-strong', step: 'bg-exam-sage-strong text-on-emerald', rail: 'bg-exam-sage/40' },
};

/** Numbered steps joined by a rail, so the order reads at a glance. */
export function Stepper({ steps, tone }: { steps: { title: string; body: string }[]; tone: QuestionGuide['color'] }) {
  const t = GUIDE_TONE[tone];
  return (
    <ol className="space-y-4">
      {steps.map((s, i) => (
        <li key={s.title} className="relative flex items-start gap-3">
          {i < steps.length - 1 && (
            <span aria-hidden className={`absolute start-[11px] top-7 -bottom-4 w-0.5 rounded-full ${t.rail}`} />
          )}
          <span className={`relative w-6 h-6 rounded-full ${t.step} text-xs font-bold flex items-center justify-center flex-shrink-0`}>{i + 1}</span>
          <div className="min-w-0 pt-0.5">
            <div className="font-semibold text-exam-ink text-sm leading-snug"><RichText text={s.title} /></div>
            <p className="text-exam-ink-soft text-[13px] leading-relaxed mt-1"><RichText text={s.body} /></p>
          </div>
        </li>
      ))}
    </ol>
  );
}

function StuckItem({ step, detail }: { step: string; detail: string }) {
  const d = useDisclosure();
  return (
    <li className="border-t border-exam-alt/30 first:border-t-0">
      <button
        type="button"
        onClick={d.toggle}
        {...d.buttonProps}
        className="w-full flex items-center justify-between gap-3 py-3 text-start"
      >
        <span className="font-semibold text-exam-ink text-sm leading-snug"><RichText text={step} /></span>
        <ChevronDown className={`w-4 h-4 flex-shrink-0 text-exam-alt transition-transform duration-300 ease-spring ${d.open ? 'rotate-180' : ''}`} aria-hidden />
      </button>
      <Reveal open={d.open} id={d.regionId}>
        <p className="pb-3 text-exam-ink-soft text-[13px] leading-relaxed"><RichText text={detail} /></p>
      </Reveal>
    </li>
  );
}

/** "Stuck?" as an FAQ: scan the situations, open only the one you're in. */
export function StuckAccordion({ items }: { items: { step: string; detail: string }[] }) {
  return (
    <div className="rounded-md border border-exam-alt/40 bg-exam-alt-bg px-4 pt-4 pb-1">
      <h3 className="font-bold text-sm mb-1 text-exam-alt flex items-center gap-1.5"><LifeBuoy className="w-4 h-4" aria-hidden />נתקעת? פרוטוקול החילוץ:</h3>
      <ul>
        {items.map(s => <StuckItem key={s.step} step={s.step} detail={s.detail} />)}
      </ul>
    </div>
  );
}

function WorkedExample({ example }: { example: QuestionGuide['workedExample'] }) {
  const d = useDisclosure();
  return (
    <div className="rounded-md border border-exam-border bg-exam-surface p-4">
      <h3 className="font-bold text-sm mb-3 text-exam-ink flex items-center gap-1.5"><NotebookPen className="w-4 h-4" aria-hidden />דוגמה מלאה עם פתרון צעד-אחר-צעד:</h3>
      {/* LTR as a whole: the prompt is exam English, and the reading-comprehension
          one interleaves short Hebrew labels that read fine inside an LTR line. */}
      <p dir="ltr" lang="en" className="font-serif text-sm text-exam-ink leading-relaxed mb-3 font-medium text-left">
        {example.prompt}
      </p>
      <ol dir="ltr" lang="en" className="grid grid-cols-1 sm:grid-cols-2 gap-2 mb-3">
        {example.options.map((opt, i) => {
          const shown = d.open && i === example.correctIndex;
          return (
            <li
              key={i}
              className={`font-serif px-3 py-2 rounded-sm text-sm border text-left transition-colors ${
                shown ? 'border-exam-sage bg-exam-sage-bg text-exam-sage-strong font-semibold' : 'border-exam-border text-exam-ink-soft'
              }`}
            >
              {i + 1}. {opt} {shown && <Check className="inline w-3.5 h-3.5" strokeWidth={3} aria-label="התשובה הנכונה" />}
            </li>
          );
        })}
      </ol>
      <p className="text-xs text-exam-ink-soft mb-2">נסה לפתור לבד, ואז פתח את הפתרון.</p>
      <DisclosureButton open={d.open} onClick={d.toggle} label="הצג פתרון צעד-אחר-צעד" openLabel="הסתר את הפתרון" buttonProps={d.buttonProps} />
      <Reveal open={d.open} id={d.regionId}>
        <ol className="space-y-2 pt-3">
          {example.walkthrough.map((line, i) => (
            <li key={i} className="flex items-start gap-2 text-[13px] text-exam-ink-soft leading-relaxed">
              <span className="flex-shrink-0 font-mono text-exam-ink-soft">{i + 1}.</span>
              <span><RichText text={line} /></span>
            </li>
          ))}
        </ol>
      </Reveal>
    </div>
  );
}

export function QuestionGuideView({ guide }: { guide: QuestionGuide }) {
  const tone = GUIDE_TONE[guide.color];
  return (
    <section>
      <div className="flex items-center gap-3 mb-4">
        <div className={`w-12 h-12 rounded-md flex items-center justify-center ${tone.badge}`}><guide.icon className="w-6 h-6" strokeWidth={1.75} aria-hidden /></div>
        <div>
          <h2 className="text-xl font-bold text-exam-ink leading-tight">{guide.titleHe}</h2>
          <span dir="ltr" lang="en" className="text-xs text-exam-ink-soft font-medium">{guide.titleEn}</span>
        </div>
      </div>

      <TopicIntro keyLine={guide.keyLine} intro={guide.intro} />

      <div className="rounded-md border border-exam-border bg-exam-surface p-4 mb-3">
        <h3 className={`font-bold text-sm mb-4 flex items-center gap-1.5 ${tone.heading}`}><Compass className="w-4 h-4" aria-hidden />כך ניגשים לשאלה:</h3>
        <Stepper steps={guide.approach.map(s => ({ title: s.step, body: s.detail }))} tone={guide.color} />
      </div>

      <div className="mb-3">
        <StuckAccordion items={guide.stuck} />
      </div>

      <div className="mb-3">
        <WorkedExample example={guide.workedExample} />
      </div>

      <Link href={guide.tipsHref} className={`hit-44 inline-block text-xs font-semibold ${tone.heading} hover:underline`}>
        <span className="inline-flex items-center gap-1">לטיפים המורחבים ולמלכודות של {guide.titleHe}<ChevronLeft className="w-3.5 h-3.5" aria-hidden /></span>
      </Link>
    </section>
  );
}
