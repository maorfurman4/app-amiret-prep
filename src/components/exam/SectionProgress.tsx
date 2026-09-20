'use client';

import { useEffect, useRef } from 'react';
import { Check } from 'lucide-react';
import { SECTION_CONFIGS } from '@/types/exam';

interface SectionProgressProps {
  currentSection: number;
  completedSections: number[];
}

const TYPE_LABELS: Record<string, string> = {
  sentence_completion: 'השלמת משפטים',
  restatement: 'ניסוח מחדש',
  reading_comprehension: 'הבנת הנקרא',
  esra: 'אנגלית ESRA',
};

export function SectionProgress({ currentSection, completedSections }: SectionProgressProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const currentRef = useRef<HTMLDivElement>(null);

  // Auto-scroll so the current section stays in view (centered) as it advances —
  // otherwise on narrow screens sections 4-7 stay hidden off to the side.
  useEffect(() => {
    currentRef.current?.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' });
  }, [currentSection]);

  return (
    <div ref={containerRef} className="flex items-center gap-1 overflow-x-auto pb-1 scroll-smooth" dir="rtl">
      {SECTION_CONFIGS.map((cfg) => {
        const isDone = completedSections.includes(cfg.index);
        const isCurrent = currentSection === cfg.index;

        return (
          <div key={cfg.index} ref={isCurrent ? currentRef : undefined} className="flex items-center gap-1 flex-shrink-0">
            <div className="flex flex-col items-center">
              <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-semibold border transition-colors ${
                isDone    ? 'bg-exam-sage border-exam-sage text-white' :
                isCurrent ? (cfg.experimental
                              ? 'bg-exam-alt border-exam-alt text-white'
                              : 'bg-exam-accent border-exam-accent text-exam-accent-ink') :
                cfg.experimental ? 'bg-exam-surface border-exam-alt/50 text-exam-alt border-dashed' :
                            'bg-exam-surface border-exam-border text-exam-ink-soft'
              }`}>
                {isDone ? <Check className="w-3.5 h-3.5" strokeWidth={3} aria-hidden /> : cfg.index}
              </div>
              <span className={`mt-1 text-[10px] whitespace-nowrap ${
                isCurrent ? (cfg.experimental ? 'text-exam-alt font-semibold' : 'text-exam-accent font-semibold') :
                isDone    ? 'text-exam-sage-strong' :
                cfg.experimental ? 'text-exam-alt/70' : 'text-exam-ink-soft'
              }`}>
                {cfg.experimental ? 'תרגול חלופי' : TYPE_LABELS[cfg.type]}
              </span>
            </div>
            {cfg.index < SECTION_CONFIGS.length && (
              <div className={`w-6 h-px mb-4 transition-colors ${isDone ? 'bg-exam-sage' : 'bg-exam-border'}`} />
            )}
          </div>
        );
      })}
    </div>
  );
}
