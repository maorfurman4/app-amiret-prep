'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { Brain, Target, PenLine, ChevronLeft, ChevronRight, ArrowRight } from 'lucide-react';
import { BackNav } from '@/components/BackNav';
import { StrategyTopic } from '@/components/strategies/StrategyTopic';
import { TOPICS, TOPIC_GROUPS, type TopicId } from '@/data/strategies';

/** Reading order = the grouped index order. */
const ORDER: TopicId[] = TOPIC_GROUPS.flatMap(g => g.ids);
const TOPIC_BY_ID = Object.fromEntries(TOPICS.map(t => [t.id, t])) as Record<TopicId, (typeof TOPICS)[number]>;

export default function StrategiesPage() {
  const [topic, setTopic] = useState<TopicId | null>(null);
  const topicRef = useRef<HTMLDivElement>(null);

  const go = (next: TopicId | null) => {
    setTopic(next);
    window.scrollTo({ top: 0 });
  };

  // The tile that opened a topic unmounts; hand focus to the topic so keyboard
  // and screen-reader users land on what they just opened.
  useEffect(() => {
    if (topic) topicRef.current?.focus({ preventScroll: true });
  }, [topic]);

  const at = topic ? ORDER.indexOf(topic) : -1;
  const prev = at > 0 ? TOPIC_BY_ID[ORDER[at - 1]] : null;
  const next = at >= 0 && at < ORDER.length - 1 ? TOPIC_BY_ID[ORDER[at + 1]] : null;

  return (
    <div className="min-h-dvh bg-exam-paper pb-24" dir="rtl">
      <BackNav backHref="/" backLabel="דף הבית" />

      <main id="main">
      <div className="bg-exam-surface border-b border-exam-border px-4 py-5">
        <h1 className="text-2xl font-bold text-exam-ink flex items-center gap-2"><Brain className="w-6 h-6" aria-hidden />המדריך המלא לפתרון האמירנ&quot;ט</h1>
        <p className="text-sm text-exam-ink-soft mt-1">
          בחר נושא. כל אחד קצר וממוקד
        </p>
      </div>

      <div className="max-w-2xl mx-auto px-4 py-6">
        {topic === null ? (
          <div className="space-y-6">
            {TOPIC_GROUPS.map(group => (
              <section key={group.title} aria-labelledby={`group-${group.ids[0]}`}>
                <h2 id={`group-${group.ids[0]}`} className="text-xs font-bold text-exam-ink-soft mb-2">{group.title}</h2>
                <ul className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                  {group.ids.map(id => {
                    const t = TOPIC_BY_ID[id];
                    return (
                      <li key={id}>
                        <button
                          type="button"
                          onClick={() => go(id)}
                          className="w-full h-full bg-exam-surface rounded-md border border-exam-border p-3 text-start hover:bg-exam-paper-alt hover:border-exam-border-strong transition-colors flex items-center gap-3 sm:flex-col sm:items-start sm:gap-1.5"
                        >
                          <span className="relative flex-shrink-0">
                            <t.icon className="w-6 h-6 text-exam-ink-soft" strokeWidth={1.5} aria-hidden />
                          </span>
                          <span className="min-w-0 flex-1">
                            <span className="flex items-center gap-1.5">
                              <span className="text-[11px] font-bold text-exam-ink-soft tabular-nums" aria-hidden>{ORDER.indexOf(id) + 1}.</span>
                              <span className="font-bold text-exam-ink text-sm leading-tight">{t.title}</span>
                            </span>
                            <span className="block text-xs text-exam-ink-soft leading-snug mt-0.5">{t.desc}</span>
                          </span>
                          <ChevronLeft className="w-4 h-4 text-exam-ink-soft flex-shrink-0 sm:hidden" aria-hidden />
                        </button>
                      </li>
                    );
                  })}
                </ul>
              </section>
            ))}
          </div>
        ) : (
          <div>
            <div className="flex items-center justify-between mb-5">
              <button
                type="button"
                onClick={() => go(null)}
                className="hit-44 text-sm text-exam-ink-soft hover:text-exam-ink flex items-center gap-1"
              >
                <ArrowRight className="w-4 h-4" aria-hidden />כל הנושאים
              </button>
              <span className="text-xs text-exam-ink-soft tabular-nums">נושא {at + 1} מתוך {ORDER.length}</span>
            </div>

            <div ref={topicRef} tabIndex={-1} className="outline-none">
              <StrategyTopic id={topic} />
            </div>

            <nav aria-label="ניווט בין נושאים" className="mt-8 grid grid-cols-2 gap-2">
              {prev ? (
                <button type="button" onClick={() => go(prev.id)} className="rounded-md border border-exam-border bg-exam-surface p-3 text-start hover:bg-exam-paper-alt transition-colors">
                  <span className="flex items-center gap-1 text-[11px] text-exam-ink-soft"><ChevronRight className="w-3.5 h-3.5" aria-hidden />הקודם</span>
                  <span className="block font-bold text-exam-ink text-sm mt-0.5">{prev.title}</span>
                </button>
              ) : <span />}
              {next ? (
                <button type="button" onClick={() => go(next.id)} className="rounded-md border border-exam-border bg-exam-surface p-3 text-end hover:bg-exam-paper-alt transition-colors">
                  <span className="flex items-center justify-end gap-1 text-[11px] text-exam-ink-soft">הבא<ChevronLeft className="w-3.5 h-3.5" aria-hidden /></span>
                  <span className="block font-bold text-exam-ink text-sm mt-0.5">{next.title}</span>
                </button>
              ) : <span />}
            </nav>

            <div className="bg-exam-accent rounded-md p-5 text-center mt-8">
              <p className="text-exam-accent-ink font-bold mb-3">התיאוריה ברורה? עכשיו מיישמים.</p>
              <div className="flex gap-3 justify-center">
                <Link href="/exam" className="px-5 py-2.5 bg-exam-accent-ink text-exam-accent rounded-sm text-sm font-bold hover:opacity-90 transition-opacity inline-flex items-center gap-1.5">
                  <Target className="w-4 h-4" aria-hidden />סימולציית הליבה
                </Link>
                <Link href="/practice" className="px-5 py-2.5 bg-exam-accent-ink/20 text-exam-accent-ink rounded-sm text-sm font-bold hover:bg-exam-accent-ink/30 transition-colors inline-flex items-center gap-1.5">
                  <PenLine className="w-4 h-4" aria-hidden />תרגול ממוקד
                </Link>
              </div>
            </div>
          </div>
        )}
      </div>
      </main>
    </div>
  );
}
