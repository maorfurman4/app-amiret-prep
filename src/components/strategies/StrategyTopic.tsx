'use client';

import Link from 'next/link';
import { ChevronLeft } from 'lucide-react';
import { RichText } from '@/components/strategies/RichText';
import { KeyLine, Prose, Expandable, SummaryCard, TopicIntro } from '@/components/strategies/GuideBlocks';
import { TimeBar } from '@/components/strategies/TimeBar';
import { ConnectorsGuide } from '@/components/strategies/ConnectorsGuide';
import { QuestionGuideView } from '@/components/strategies/QuestionGuideView';
import {
  RULES_INTRO, GAME_RULES, TIME_INTRO, TIME_BUDGET, GUIDE_BY_ID, INVEST_INTRO, INVEST_POINTS,
  METHODS_INTRO, MARKET_METHODS, HABITS_INTRO, HABITS, TOPIC_KEYLINES, type TopicId,
} from '@/data/strategies';

function Heading({ children }: { children: React.ReactNode }) {
  return <h2 className="text-lg font-bold text-exam-ink mb-3">{children}</h2>;
}

/** One topic of the /strategies guide, rendered from src/data/strategies.ts. */
export function StrategyTopic({ id }: { id: TopicId }) {
  switch (id) {
    case 'rules':
      return (
        <section>
          <Heading>חוקי המשחק</Heading>
          <TopicIntro keyLine={TOPIC_KEYLINES.rules} intro={RULES_INTRO} />
          <div className="space-y-3">
            {GAME_RULES.map(r => <SummaryCard key={r.title} icon={r.icon} title={r.title} keyLine={r.keyLine} body={r.body} />)}
          </div>
        </section>
      );

    case 'time':
      return (
        <section>
          <Heading>תקציב הזמן שלך, כולל &quot;תקציב תקיעה&quot;</Heading>
          <TopicIntro keyLine={TOPIC_KEYLINES.time} intro={TIME_INTRO} />
          <div className="space-y-3">
            {TIME_BUDGET.map(row => (
              <article key={row.section} className="rounded-md border border-exam-border bg-exam-surface p-4">
                <div className="flex items-center justify-between gap-2 mb-3">
                  <h3 className="font-bold text-exam-ink text-[15px]">{row.section}</h3>
                  <span className="text-xs bg-exam-paper-alt text-exam-ink-soft px-2 py-1 rounded-sm">{row.total}</span>
                </div>
                <TimeBar row={row} />
                <div className="mt-3"><KeyLine text={row.keyLine} boxed={false} /></div>
                <div className="mt-2">
                  <Expandable label="למה? ההסבר המלא" openLabel="הסתר את ההסבר">
                    <Prose text={row.note} />
                  </Expandable>
                </div>
              </article>
            ))}
          </div>
        </section>
      );

    case 'sentence-completion':
    case 'restatement':
    case 'reading-comprehension':
      return <QuestionGuideView guide={GUIDE_BY_ID[id]} />;

    case 'connectors':
      return <ConnectorsGuide />;

    case 'invest':
      return (
        <section>
          <Heading>איפה כן שווה &quot;להיתקע&quot;</Heading>
          <TopicIntro keyLine={TOPIC_KEYLINES.invest} intro={INVEST_INTRO} />
          <div className="space-y-3">
            {INVEST_POINTS.map(p => <SummaryCard key={p.title} icon={p.icon} title={p.title} keyLine={p.keyLine} body={p.body} />)}
          </div>
        </section>
      );

    case 'methods':
      return (
        <section>
          <Heading>שיטות הקריאה בשוק, ומה אנחנו ממליצים</Heading>
          <TopicIntro keyLine={TOPIC_KEYLINES.methods} intro={METHODS_INTRO} />
          <div className="space-y-3">
            {MARKET_METHODS.map(m => (
              <article
                key={m.title}
                className={`rounded-md border p-4 ${
                  m.recommended ? 'bg-exam-sage-bg border-exam-sage ring-1 ring-exam-sage/50' : 'bg-exam-surface border-exam-border'
                }`}
              >
                <div className="flex items-center gap-2 mb-0.5">
                  <h3 className="font-bold text-exam-ink text-[15px]">{m.title}</h3>
                  {m.recommended && <span className="text-[10px] font-bold bg-exam-sage-strong text-on-emerald px-2 py-0.5 rounded-sm">מומלץ</span>}
                </div>
                <div className="text-xs text-exam-ink-soft mb-3">{m.who}</div>
                <p className="text-sm text-exam-ink leading-relaxed mb-1.5"><RichText text={m.fit} /></p>
                <p className="text-[13px] text-exam-ink-soft leading-relaxed"><RichText text={m.tradeoff} /></p>
              </article>
            ))}
          </div>
        </section>
      );

    case 'habits':
      return (
        <section>
          <Heading>ההכנה שעובדת</Heading>
          <TopicIntro keyLine={TOPIC_KEYLINES.habits} intro={HABITS_INTRO} />
          <ul className="rounded-md border border-exam-border bg-exam-surface divide-y divide-exam-border">
            {HABITS.map((h, i) => (
              <li key={i} className="flex items-start gap-3 p-4">
                <h.icon className="w-5 h-5 text-exam-ink-soft flex-shrink-0" strokeWidth={1.5} aria-hidden />
                <div>
                  <p className="text-sm text-exam-ink-soft leading-relaxed"><RichText text={h.text} /></p>
                  {h.href && (
                    <Link href={h.href} className="hit-44 inline-block mt-1.5 text-xs font-bold text-exam-accent hover:underline">
                      <span className="inline-flex items-center gap-1">{h.cta}<ChevronLeft className="w-3.5 h-3.5" aria-hidden /></span>
                    </Link>
                  )}
                </div>
              </li>
            ))}
          </ul>
        </section>
      );
  }
}
