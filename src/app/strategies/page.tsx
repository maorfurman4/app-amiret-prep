'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Compass, LifeBuoy, NotebookPen, Lightbulb, Brain, Target, Check, PenLine } from 'lucide-react';
import { BackNav } from '@/components/BackNav';
import { RichText } from '@/components/strategies/RichText';
import {
  RULES_INTRO, GAME_RULES, TIME_INTRO, TIME_BUDGET, QUESTION_GUIDES, CONNECTORS_INTRO, CONNECTORS_OUTRO,
  CONNECTOR_CATEGORIES, INVEST_INTRO, INVEST_POINTS, METHODS_INTRO, MARKET_METHODS, HABITS_INTRO, HABITS, TOPICS,
  type QuestionGuide, type TopicId,
} from '@/data/strategies';

const CATEGORY_COLOR: Record<string, string> = {
  red: 'bg-exam-wrong-bg text-exam-wrong',
  blue: 'bg-exam-accent/10 text-exam-accent',
  green: 'bg-exam-sage-bg text-exam-sage-strong',
  amber: 'bg-exam-alt-bg text-exam-alt',
};

const CATEGORY_BORDER: Record<string, string> = {
  red: 'border-exam-wrong/40',
  blue: 'border-exam-accent/30',
  green: 'border-exam-sage/40',
  amber: 'border-exam-alt/40',
};

/* ─── עיצוב ───────────────────────────────────────────────────────────────── */

const COLOR_MAP: Record<string, { bg: string; border: string; badge: string; heading: string; step: string }> = {
  blue: {
    bg: 'bg-exam-accent/5',
    border: 'border-exam-accent/30',
    badge: 'bg-exam-accent/10 text-exam-accent',
    heading: 'text-exam-accent',
    step: 'bg-exam-accent text-exam-accent-ink',
  },
  purple: {
    bg: 'bg-exam-alt-bg',
    border: 'border-exam-alt/40',
    badge: 'bg-exam-alt-bg text-exam-alt',
    heading: 'text-exam-alt',
    step: 'bg-exam-alt text-on-amber',
  },
  green: {
    bg: 'bg-exam-sage-bg',
    border: 'border-exam-sage/40',
    badge: 'bg-exam-sage-bg text-exam-sage-strong',
    heading: 'text-exam-sage-strong',
    step: 'bg-exam-sage-strong text-on-emerald',
  },
};

/* ─── תצוגת טקסט קריאה — מפרק פסקאות ארוכות למשפטים נפרדים, ומדגיש את
   המסקנה המעשית (אם המחבר סימן אותה במפורש) כתיבת "בשורה תחתונה" נבדלת ───── */

const TAKEAWAY_MARKERS = [
  'המסקנה המעשית:', 'המסקנה החד-משמעית:', 'המסקנה:',
  'הכלל הזהב:', 'הטריק:', 'שימו לב:', 'זכרו:', 'תרגיל מהיר שעובד תמיד:',
];

function splitIntoSentences(text: string): string[] {
  return text
    .split(/(?<=[.!?])\s+(?=\S)/)
    .map(s => s.trim())
    .filter(Boolean);
}

const TONE_CLASS: Record<'intro' | 'body' | 'muted', string> = {
  intro: 'text-sm text-exam-ink leading-relaxed',
  body: 'text-sm text-exam-ink-soft leading-relaxed',
  muted: 'text-xs text-exam-ink-soft leading-relaxed',
};

function TextBlock({ text, tone = 'body' }: { text: string; tone?: 'intro' | 'body' | 'muted' }) {
  const pClass = TONE_CLASS[tone];
  const markerIdx = TAKEAWAY_MARKERS
    .map(m => text.indexOf(m))
    .filter(i => i !== -1)
    .sort((a, b) => a - b)[0];

  const lead = markerIdx !== undefined ? text.slice(0, markerIdx).trim() : text;
  const takeaway = markerIdx !== undefined ? text.slice(markerIdx).trim() : null;
  const leadSentences = splitIntoSentences(lead);

  return (
    <div>
      {leadSentences.map((s, i) => (
        <p key={i} className={`${pClass} ${i < leadSentences.length - 1 ? 'mb-1.5' : ''}`}>{s}</p>
      ))}
      {takeaway && (
        <div className="mt-2 flex items-start gap-2 bg-exam-alt-bg border border-exam-alt/40 rounded-sm px-3 py-2">
          <Lightbulb className="w-3.5 h-3.5 text-exam-alt flex-shrink-0 mt-0.5" aria-hidden />
          <p className="text-exam-ink text-sm leading-relaxed font-medium">{takeaway}</p>
        </div>
      )}
    </div>
  );
}

function QuestionGuideDetail({ guide }: { guide: QuestionGuide }) {
  const colors = COLOR_MAP[guide.color];
  return (
    <div>
      <div className="flex items-center gap-3 mb-4">
        <div className={`w-12 h-12 rounded-md flex items-center justify-center ${colors.badge}`}><guide.icon className="w-6 h-6" strokeWidth={1.75} aria-hidden /></div>
        <div>
          <h1 className="text-xl font-bold text-exam-ink leading-tight">{guide.titleHe}</h1>
          <span className="text-xs text-exam-ink-soft font-medium">{guide.titleEn}</span>
        </div>
      </div>

      <div className="mb-4 bg-exam-surface rounded-md border border-exam-border p-4">
        <TextBlock text={guide.intro} tone="intro" />
      </div>

      <div className={`rounded-md border ${colors.bg} ${colors.border} p-4 mb-3`}>
        <h4 className={`font-bold text-sm mb-3 flex items-center gap-1.5 ${colors.heading}`}><Compass className="w-4 h-4" aria-hidden />כך ניגשים לשאלה:</h4>
        <ol className="space-y-3">
          {guide.approach.map((s, i) => (
            <li key={i} className="flex items-start gap-2.5">
              <span className={`w-5 h-5 rounded-full ${colors.step} text-[11px] font-bold flex items-center justify-center flex-shrink-0 mt-0.5`}>{i + 1}</span>
              <div>
                <span className="font-semibold text-exam-ink text-sm"><RichText text={s.step} /></span>
                <p className="text-exam-ink-soft text-xs leading-relaxed mt-0.5"><RichText text={s.detail} /></p>
              </div>
            </li>
          ))}
        </ol>
      </div>

      <div className="rounded-md border border-exam-alt/40 bg-exam-alt-bg p-4 mb-3">
        <h4 className="font-bold text-sm mb-3 text-exam-alt flex items-center gap-1.5"><LifeBuoy className="w-4 h-4" aria-hidden />נתקעת? פרוטוקול החילוץ:</h4>
        <div className="space-y-3">
          {guide.stuck.map((s, i) => (
            <div key={i} className="flex items-start gap-2.5">
              <span className="text-exam-alt flex-shrink-0 mt-0.5 text-sm">◄</span>
              <div>
                <span className="font-semibold text-exam-ink text-sm"><RichText text={s.step} /></span>
                <p className="text-exam-ink-soft text-xs leading-relaxed mt-0.5"><RichText text={s.detail} /></p>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="rounded-md border border-exam-border bg-exam-surface p-4 mb-3">
        <h4 className="font-bold text-sm mb-3 text-exam-ink flex items-center gap-1.5"><NotebookPen className="w-4 h-4" aria-hidden />דוגמה מלאה עם פתרון צעד-אחר-צעד:</h4>
        <p dir="ltr" className="font-serif text-sm text-exam-ink leading-relaxed mb-3 font-medium">
          {guide.workedExample.prompt}
        </p>
        <div dir="ltr" className="grid grid-cols-1 sm:grid-cols-2 gap-2 mb-4">
          {guide.workedExample.options.map((opt, i) => (
            <div
              key={i}
              className={`font-serif px-3 py-2 rounded-sm text-sm border ${
                i === guide.workedExample.correctIndex
                  ? 'border-exam-sage bg-exam-sage-bg text-exam-sage-strong font-semibold'
                  : 'border-exam-border text-exam-ink-soft'
              }`}
            >
              {i + 1}. {opt} {i === guide.workedExample.correctIndex && <Check className="inline w-3.5 h-3.5" strokeWidth={3} aria-hidden />}
            </div>
          ))}
        </div>
        <ol className="space-y-2">
          {guide.workedExample.walkthrough.map((line, i) => (
            <li key={i} className="flex items-start gap-2 text-xs text-exam-ink-soft leading-relaxed">
              <span className="text-exam-ink-soft flex-shrink-0 font-mono">{i + 1}.</span>
              <span>{line}</span>
            </li>
          ))}
        </ol>
      </div>

      <Link href={guide.tipsHref} className={`inline-block text-xs font-semibold ${colors.heading} hover:underline`}>
        ← לטיפים המורחבים והמלכודות של {guide.titleHe}
      </Link>
    </div>
  );
}

export default function StrategiesPage() {
  const [topic, setTopic] = useState<TopicId | null>(null);

  return (
    <div className="min-h-dvh bg-exam-paper pb-24" dir="rtl">
      <BackNav backHref="/" backLabel="דף הבית" />

      {/* Header */}
      <div className="bg-exam-surface border-b border-exam-border px-4 py-5">
        <h1 className="text-2xl font-bold text-exam-ink flex items-center gap-2"><Brain className="w-6 h-6" aria-hidden />המדריך המלא לפתרון האמירנ&quot;ט</h1>
        <p className="text-sm text-exam-ink-soft mt-1">
          בחר נושא — כל נושא ממוקד ומהיר לגלילה
        </p>
      </div>

      <div className="max-w-2xl mx-auto px-4 py-6">
        {topic === null ? (
          /* ── מסך הקוביות ── */
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {TOPICS.map(t => (
              <button
                key={t.id}
                onClick={() => setTopic(t.id)}
                className="bg-exam-surface rounded-md border border-exam-border p-4 text-right hover:bg-exam-paper-alt hover:border-exam-border-strong transition-colors flex flex-col gap-1.5"
              >
                <t.icon className="w-6 h-6 text-exam-ink-soft" strokeWidth={1.5} aria-hidden />
                <span className="font-bold text-exam-ink text-sm leading-tight">{t.title}</span>
                <span className="text-[11px] text-exam-ink-soft leading-snug">{t.desc}</span>
              </button>
            ))}
          </div>
        ) : (
          /* ── תצוגת נושא בודד ── */
          <div>
            <button
              onClick={() => setTopic(null)}
              className="text-sm text-exam-ink-soft hover:text-exam-ink mb-5 flex items-center gap-1"
            >
              ← כל הנושאים
            </button>

            {topic === 'rules' && (
              <section>
                <h2 className="text-lg font-bold text-exam-ink mb-3">חוקי המשחק</h2>
                <div className="mb-5 bg-exam-surface rounded-md border border-exam-border p-4">
                  <TextBlock text={RULES_INTRO} tone="intro" />
                </div>
                <div className="space-y-4">
                  {GAME_RULES.map(rule => (
                    <div key={rule.title} className="bg-exam-surface rounded-md border border-exam-border p-4 flex items-start gap-3">
                      <rule.icon className="w-6 h-6 text-exam-ink-soft flex-shrink-0" strokeWidth={1.5} aria-hidden />
                      <div className="flex-1 min-w-0">
                        <h3 className="font-bold text-exam-ink text-sm mb-1.5">{rule.title}</h3>
                        <TextBlock text={rule.body} tone="body" />
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            )}

            {topic === 'time' && (
              <section>
                <h2 className="text-lg font-bold text-exam-ink mb-3">תקציב הזמן שלך — כולל &quot;תקציב תקיעה&quot;</h2>
                <div className="mb-5 bg-exam-surface rounded-md border border-exam-border p-4">
                  <TextBlock text={TIME_INTRO} tone="intro" />
                </div>
                <div className="space-y-3">
                  {TIME_BUDGET.map(row => (
                    <div key={row.section} className="bg-exam-surface rounded-md border border-exam-border p-4">
                      <div className="flex items-center justify-between mb-2">
                        <h3 className="font-bold text-exam-ink text-sm">{row.section}</h3>
                        <span className="text-xs font-mono bg-exam-paper-alt text-exam-ink-soft px-2 py-1 rounded-sm">{row.total}</span>
                      </div>
                      <div className="grid grid-cols-2 gap-2 mb-2">
                        <div className="bg-exam-paper-alt rounded-sm px-3 py-2">
                          <div className="text-[11px] text-exam-ink-soft">זמן לשאלה</div>
                          <div className="text-sm font-bold text-exam-ink">{row.perQ}</div>
                        </div>
                        <div className="bg-exam-alt-bg rounded-sm px-3 py-2">
                          <div className="text-[11px] text-exam-alt">מקסימום תקיעה</div>
                          <div className="text-sm font-bold text-exam-alt">{row.stuckCap}</div>
                        </div>
                      </div>
                      <TextBlock text={row.note} tone="muted" />
                    </div>
                  ))}
                </div>
              </section>
            )}

            {(topic === 'sentence-completion' || topic === 'restatement' || topic === 'reading-comprehension') && (
              <QuestionGuideDetail guide={QUESTION_GUIDES.find(g => g.id === topic)!} />
            )}

            {topic === 'connectors' && (
              <section>
                <h2 className="text-lg font-bold text-exam-ink mb-3">מילות הקישור שקובעות הכל</h2>

                <div className="mb-6 bg-exam-surface rounded-md border border-exam-border p-4">
                  <TextBlock text={CONNECTORS_INTRO} tone="intro" />
                </div>

                <div className="space-y-8">
                  {CONNECTOR_CATEGORIES.map(cat => (
                    <div key={cat.id}>
                      <div className="flex items-center gap-2.5 mb-2">
                        <span className={`w-9 h-9 rounded-md flex items-center justify-center ${CATEGORY_COLOR[cat.color]}`}><cat.icon className="w-4 h-4" strokeWidth={1.75} aria-hidden /></span>
                        <h3 className="font-bold text-exam-ink text-base">{cat.title}</h3>
                      </div>
                      <div className="mb-3">
                        <TextBlock text={cat.intro} tone="body" />
                      </div>

                      <div className={`space-y-4 border-r-2 ${CATEGORY_BORDER[cat.color]} pr-4`}>
                        {cat.words.map(w => (
                          <div key={w.word}>
                            <div className="flex items-baseline gap-2 flex-wrap mb-1">
                              <span dir="ltr" className="font-serif font-bold text-exam-ink text-sm">{w.word}</span>
                              <span className="text-exam-ink-soft text-xs">— {w.meaning}</span>
                            </div>
                            <div className="mb-2">
                              <TextBlock text={w.grammar} tone="body" />
                            </div>
                            <p dir="ltr" className="font-serif text-sm text-exam-ink italic bg-exam-paper-alt rounded-sm px-3 py-1.5 mb-1.5">
                              {w.example}
                            </p>
                            <TextBlock text={w.exampleExplain} tone="muted" />
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>

                <div className="mt-6 bg-exam-accent/10 border border-exam-accent/30 rounded-md p-4">
                  <TextBlock text={CONNECTORS_OUTRO} tone="intro" />
                </div>
              </section>
            )}

            {topic === 'invest' && (
              <section>
                <h2 className="text-lg font-bold text-exam-ink mb-3">איפה כן שווה &quot;להיתקע&quot;</h2>
                <div className="mb-5 bg-exam-surface rounded-md border border-exam-border p-4">
                  <TextBlock text={INVEST_INTRO} tone="intro" />
                </div>
                <div className="space-y-3">
                  {INVEST_POINTS.map(p => (
                    <div key={p.title} className="bg-exam-surface rounded-md border border-exam-border p-4 flex items-start gap-3">
                      <p.icon className="w-5 h-5 text-exam-ink-soft flex-shrink-0" strokeWidth={1.5} aria-hidden />
                      <div className="flex-1 min-w-0">
                        <h3 className="font-bold text-exam-ink text-sm mb-1">{p.title}</h3>
                        <TextBlock text={p.body} tone="body" />
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            )}

            {topic === 'methods' && (
              <section>
                <h2 className="text-lg font-bold text-exam-ink mb-3">שיטות הקריאה בשוק — ומה אנחנו ממליצים</h2>
                <div className="mb-5 bg-exam-surface rounded-md border border-exam-border p-4">
                  <TextBlock text={METHODS_INTRO} tone="intro" />
                </div>
                <div className="space-y-3">
                  {MARKET_METHODS.map(m => (
                    <div
                      key={m.title}
                      className={`rounded-md border p-4 ${
                        m.recommended
                          ? 'bg-exam-sage-bg border-exam-sage ring-1 ring-exam-sage/50'
                          : 'bg-exam-surface border-exam-border'
                      }`}
                    >
                      <div className="flex items-center gap-2 mb-1">
                        <h3 className="font-bold text-exam-ink text-sm">{m.title}</h3>
                        {m.recommended && (
                          <span className="text-[10px] font-bold bg-exam-sage-strong text-on-emerald px-2 py-0.5 rounded-sm">מומלץ</span>
                        )}
                      </div>
                      <div className="text-xs text-exam-ink-soft mb-2">{m.who}</div>
                      <p className="text-sm text-exam-ink-soft leading-relaxed mb-1">{m.fit}</p>
                      <p className="text-xs text-exam-ink-soft leading-relaxed">{m.tradeoff}</p>
                    </div>
                  ))}
                </div>
              </section>
            )}

            {topic === 'habits' && (
              <section>
                <h2 className="text-lg font-bold text-exam-ink mb-3">ההכנה שעובדת</h2>
                <div className="mb-5 bg-exam-surface rounded-md border border-exam-border p-4">
                  <TextBlock text={HABITS_INTRO} tone="intro" />
                </div>
                <div className="bg-exam-surface rounded-md border border-exam-border divide-y divide-exam-border">
                  {HABITS.map((h, i) => (
                    <div key={i} className="flex items-start gap-3 p-4">
                      <h.icon className="w-5 h-5 text-exam-ink-soft flex-shrink-0" strokeWidth={1.5} aria-hidden />
                      <div>
                        <p className="text-sm text-exam-ink-soft leading-relaxed">{h.text}</p>
                        {h.href && (
                          <Link href={h.href} className="inline-block mt-1.5 text-xs font-bold text-exam-accent hover:underline">
                            {h.cta}
                          </Link>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            )}

            {/* CTA */}
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
    </div>
  );
}
