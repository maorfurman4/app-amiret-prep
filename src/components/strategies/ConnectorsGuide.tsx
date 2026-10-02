'use client';

import { ChevronDown } from 'lucide-react';
import { RichText } from '@/components/strategies/RichText';
import { Reveal } from '@/components/strategies/Reveal';
import { withHighlights } from '@/components/strategies/ProgressiveRuleCard';
import { KeyLine, Prose, Expandable, TopicIntro, useDisclosure } from '@/components/strategies/GuideBlocks';
import {
  CONNECTORS_INTRO, CONNECTORS_OUTRO, CONNECTOR_CATEGORIES, TOPIC_KEYLINES,
  type ConnectorCategory, type ConnectorWord,
} from '@/data/strategies';

type CategoryColor = ConnectorCategory['color'];

const TONE: Record<CategoryColor, { chip: string; head: string; mark: string }> = {
  red: { chip: 'bg-exam-wrong-bg text-exam-wrong', head: 'bg-exam-wrong-bg text-exam-wrong', mark: 'bg-exam-wrong/15 text-exam-wrong ring-exam-wrong/40' },
  blue: { chip: 'bg-exam-accent/10 text-exam-accent', head: 'bg-exam-accent/10 text-exam-accent', mark: 'bg-exam-accent/15 text-exam-accent ring-exam-accent/30' },
  green: { chip: 'bg-exam-sage-bg text-exam-sage-strong', head: 'bg-exam-sage-bg text-exam-sage-strong', mark: 'bg-exam-sage/20 text-exam-sage-strong ring-exam-sage/50' },
  amber: { chip: 'bg-exam-alt-bg text-exam-alt', head: 'bg-exam-alt-bg text-exam-alt', mark: 'bg-exam-alt/20 text-exam-alt ring-exam-alt/40' },
};

const sectionId = (cat: ConnectorCategory) => `connectors-${cat.id}`;

/** The connector itself inside its example sentence: earliest whole-word match of any of its forms. */
function connectorPhrase(word: string, example: string): string[] {
  const hits = word
    .split('/')
    .map(v => v.trim())
    .filter(Boolean)
    .map(v => {
      const m = new RegExp(`\\b${v.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i').exec(example);
      return m ? { at: m.index, text: m[0] } : null;
    })
    .filter((h): h is { at: number; text: string } => h !== null)
    .sort((a, b) => a.at - b.at || b.text.length - a.text.length);
  return hits.length ? [hits[0].text] : [];
}

function WordRow({ w, tone }: { w: ConnectorWord; tone: CategoryColor }) {
  const d = useDisclosure();
  return (
    <li className="border-t border-exam-border first:border-t-0">
      <button
        type="button"
        onClick={d.toggle}
        {...d.buttonProps}
        className={`w-full grid grid-cols-[minmax(0,1fr)_auto_auto] items-center gap-2 px-3 py-3 text-start transition-colors hover:bg-exam-paper-alt ${d.open ? 'bg-exam-paper-alt' : ''}`}
      >
        <span className="min-w-0">
          <span dir="ltr" lang="en" className="block text-end font-serif font-bold text-exam-ink text-[15px] leading-snug">{w.word}</span>
          <span className="block text-xs text-exam-ink-soft mt-0.5">{w.meaning}</span>
        </span>
        {w.pattern ? (
          <span dir="auto" className="rounded-full border border-exam-border bg-exam-surface px-2 py-0.5 text-[11px] font-semibold text-exam-ink max-w-[9.5rem] text-center leading-snug">
            <RichText text={w.pattern.chip} />
          </span>
        ) : <span />}
        <ChevronDown className={`w-4 h-4 text-exam-ink-soft transition-transform duration-300 ease-spring ${d.open ? 'rotate-180' : ''}`} aria-hidden />
      </button>
      <Reveal open={d.open} id={d.regionId}>
        <div className="px-3 pb-4 pt-1 space-y-3 bg-exam-paper-alt">
          <Prose text={w.grammar} />
          <div>
            <div className="text-[11px] font-bold text-exam-ink-soft mb-1">דוגמה</div>
            <p dir="ltr" lang="en" className="font-serif text-[15px] text-exam-ink italic leading-relaxed rounded-sm bg-exam-surface border border-exam-border px-3 py-2 text-left">
              {withHighlights(w.example, connectorPhrase(w.word, w.example), TONE[tone].mark)}
            </p>
          </div>
          <Prose text={w.exampleExplain} tone="muted" />
        </div>
      </Reveal>
    </li>
  );
}

function CategorySection({ cat }: { cat: ConnectorCategory }) {
  const tone = TONE[cat.color];
  return (
    <section id={sectionId(cat)} aria-labelledby={`${sectionId(cat)}-title`} className="scroll-mt-20">
      <div className="flex items-center gap-2.5 mb-2">
        <span className={`w-9 h-9 rounded-md flex items-center justify-center ${tone.head}`}>
          <cat.icon className="w-4 h-4" strokeWidth={1.75} aria-hidden />
        </span>
        <h3 id={`${sectionId(cat)}-title`} className="font-bold text-exam-ink text-base">{cat.title}</h3>
      </div>
      <div className="space-y-2 mb-3">
        <KeyLine text={cat.keyLine} label="הכלל" boxed={false} />
        <Expandable label={`עוד על ${cat.title}`} openLabel="הסתר">
          <Prose text={cat.intro} />
        </Expandable>
      </div>
      <ul className="rounded-md border border-exam-border bg-exam-surface overflow-hidden">
        {cat.words.map(w => <WordRow key={w.word} w={w} tone={cat.color} />)}
      </ul>
    </section>
  );
}

export function ConnectorsGuide() {
  return (
    <section>
      <h2 className="text-lg font-bold text-exam-ink mb-3">מילות הקישור שקובעות הכל</h2>
      <TopicIntro keyLine={TOPIC_KEYLINES.connectors} intro={CONNECTORS_INTRO} />

      <nav aria-label="קבוצות מילות קישור" className="flex flex-wrap gap-2 mb-6">
        {CONNECTOR_CATEGORIES.map(cat => (
          <a key={cat.id} href={`#${sectionId(cat)}`} className={`hit-44 rounded-full px-3 py-1 text-xs font-bold ${TONE[cat.color].chip}`}>
            {cat.title} · {cat.words.length}
          </a>
        ))}
      </nav>

      <p className="text-xs text-exam-ink-soft mb-4">הקש על מילה כדי לראות את הדקדוק שלה, דוגמה והסבר.</p>

      <div className="space-y-8">
        {CONNECTOR_CATEGORIES.map(cat => <CategorySection key={cat.id} cat={cat} />)}
      </div>

      <div className="mt-8 rounded-md border border-exam-accent/30 bg-exam-accent/10 p-4">
        <Prose text={CONNECTORS_OUTRO} tone="intro" />
      </div>
    </section>
  );
}
