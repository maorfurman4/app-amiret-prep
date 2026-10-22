'use client';

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

// One word per step, so all of them fit side by side on a 375px phone.
const SHORT_LABELS: Record<string, string> = {
  sentence_completion: 'השלמה',
  restatement: 'ניסוח',
  reading_comprehension: 'קריאה',
  esra: 'ESRA',
};

export function SectionProgress({ currentSection, completedSections }: SectionProgressProps) {
  return (
    // Every step fits the width (no sideways scroll), so no section hides
    // off-screen; each step says its state in words.
    <div role="region" aria-label="התקדמות בפרקי המבחן" className="flex items-center gap-1 pb-1" dir="rtl">
      {SECTION_CONFIGS.map((cfg) => {
        const isDone = completedSections.includes(cfg.index);
        const isCurrent = currentSection === cfg.index;

        return (
          <div key={cfg.index} aria-current={isCurrent ? 'step' : undefined} className="flex items-center gap-1 flex-1 last:flex-none">
            <div className="flex flex-col items-center">
              <span className="sr-only">{`פרק ${cfg.index}${isDone ? ', הושלם' : isCurrent ? ', הפרק הנוכחי' : ''}: ${cfg.experimental ? 'תרגול חלופי' : TYPE_LABELS[cfg.type]}`}</span>
              <div aria-hidden className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-semibold border transition-colors ${
                isDone    ? 'bg-exam-sage border-exam-sage text-on-emerald' :
                isCurrent ? (cfg.experimental
                              ? 'bg-exam-alt border-exam-alt text-on-amber'
                              : 'bg-exam-accent border-exam-accent text-exam-accent-ink') :
                cfg.experimental ? 'bg-exam-surface border-exam-alt/50 text-exam-alt border-dashed' :
                            'bg-exam-surface border-exam-border text-exam-ink-soft'
              }`}>
                {isDone ? <Check className="w-3.5 h-3.5" strokeWidth={3} aria-hidden /> : cfg.index}
              </div>
              <span aria-hidden className={`mt-1 text-[10px] whitespace-nowrap ${
                isCurrent ? (cfg.experimental ? 'text-exam-alt font-semibold' : 'text-exam-accent font-semibold') :
                isDone    ? 'text-exam-sage-strong' :
                cfg.experimental ? 'text-exam-alt' : 'text-exam-ink-soft'
              }`}>
                <span className="sm:hidden">{cfg.experimental ? 'חלופי' : SHORT_LABELS[cfg.type]}</span>
                <span className="hidden sm:inline">{cfg.experimental ? 'תרגול חלופי' : TYPE_LABELS[cfg.type]}</span>
              </span>
            </div>
            {cfg.index < SECTION_CONFIGS.length && (
              <div aria-hidden className={`flex-1 min-w-1 h-px mb-4 transition-colors ${isDone ? 'bg-exam-sage' : 'bg-exam-border'}`} />
            )}
          </div>
        );
      })}
    </div>
  );
}
