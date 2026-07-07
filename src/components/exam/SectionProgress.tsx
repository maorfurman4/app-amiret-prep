'use client';

import { useEffect, useRef } from 'react';
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
            <div className={`flex flex-col items-center ${isCurrent ? 'scale-105' : ''}`}>
              <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold border-2 transition-all ${
                isDone    ? 'bg-green-500 border-green-500 text-white' :
                isCurrent ? (cfg.experimental
                              ? 'bg-purple-600 border-purple-600 text-white shadow-md shadow-purple-200'
                              : 'bg-blue-600 border-blue-600 text-white shadow-md shadow-blue-200') :
                cfg.experimental ? 'bg-white dark:bg-slate-800 border-purple-300 dark:border-purple-700 text-purple-400 border-dashed' :
                            'bg-white dark:bg-slate-800 border-slate-300 dark:border-slate-600 text-slate-400 dark:text-slate-500'
              }`}>
                {isDone ? '✓' : cfg.index}
              </div>
              <span className={`mt-1 text-[10px] whitespace-nowrap ${
                isCurrent ? (cfg.experimental ? 'text-purple-600 font-semibold' : 'text-blue-600 font-semibold') :
                isDone    ? 'text-green-600' :
                cfg.experimental ? 'text-purple-400' : 'text-slate-400 dark:text-slate-500'
              }`}>
                {cfg.experimental ? 'ניסיוני' : TYPE_LABELS[cfg.type]}
              </span>
            </div>
            {cfg.index < SECTION_CONFIGS.length && (
              <div className={`w-6 h-0.5 mb-4 transition-all ${isDone ? 'bg-green-400' : 'bg-slate-200 dark:bg-slate-700'}`} />
            )}
          </div>
        );
      })}
    </div>
  );
}
