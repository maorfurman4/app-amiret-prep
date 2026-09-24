import Link from 'next/link';
import { AlertTriangle, X } from 'lucide-react';
import { BackNav } from '@/components/BackNav';
import { RichText } from '@/components/strategies/RichText';
import { ProgressiveRuleCard } from '@/components/strategies/ProgressiveRuleCard';
import { GUIDE_BY_ID, TIME_BY_TYPE, type CtaTone, type QuestionTypeId } from '@/data/strategies';

const CTA_CLASS: Record<CtaTone, { box: string; icon: string }> = {
  accent: { box: 'bg-exam-accent/10 border-exam-accent/30 hover:bg-exam-accent/15', icon: 'text-exam-accent' },
  alt: { box: 'bg-exam-alt-bg border-exam-alt/40 hover:opacity-90', icon: 'text-exam-alt' },
  sage: { box: 'bg-exam-sage-bg border-exam-sage/40 hover:opacity-90', icon: 'text-exam-sage-strong' },
};

const KIND_CLASS: Record<CtaTone, string> = {
  accent: 'bg-exam-accent/10 border-exam-accent/30',
  alt: 'bg-exam-alt-bg border-exam-alt/40',
  sage: 'bg-exam-sage-bg border-exam-sage/40',
};

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-exam-surface rounded-md p-6 border border-exam-border">
      <h2 className="text-lg font-bold text-exam-ink mb-4">{title}</h2>
      {children}
    </div>
  );
}

/** The /tips/[type] deep-dive page, rendered from src/data/strategies.ts. */
export function TipsGuide({ type }: { type: QuestionTypeId }) {
  const guide = GUIDE_BY_ID[type];
  const deep = guide.deep;
  const time = TIME_BY_TYPE[type];

  return (
    <div className="min-h-dvh bg-exam-paper flex flex-col" dir="rtl">
      <BackNav backHref="/tips" backLabel="אסטרטגיות" />
      <div className="flex-1 flex flex-col items-center px-4 py-10">
        <div className="w-full max-w-2xl space-y-8">

          <div className="text-center">
            <guide.icon className="w-9 h-9 mx-auto mb-3 text-exam-ink" strokeWidth={1.5} aria-hidden />
            <h1 className="text-3xl font-bold text-exam-ink mb-2">{guide.titleHe}</h1>
            <p className="text-exam-ink-soft text-sm">{deep.subtitle}</p>
          </div>

          {deep.whatItTests && (
            <Card title={deep.whatItTests.title}>
              <p className="text-exam-ink-soft text-sm leading-relaxed"><RichText text={deep.whatItTests.body} /></p>
            </Card>
          )}

          {deep.method && (
            <Card title={deep.method.title}>
              {deep.method.intro && (
                <p className="text-exam-ink-soft text-sm leading-relaxed mb-4"><RichText text={deep.method.intro} /></p>
              )}
              <ol className="space-y-3">
                {deep.method.steps.map((s, i) => (
                  <li key={s.title} className="bg-exam-paper-alt border border-exam-border p-4 rounded-sm">
                    <div className="flex items-center gap-2 mb-1">
                      {deep.method!.numbered && (
                        <span className="w-6 h-6 rounded-full bg-exam-accent text-exam-accent-ink text-xs font-bold flex items-center justify-center flex-shrink-0">
                          {i + 1}
                        </span>
                      )}
                      <span className="font-bold text-exam-ink text-sm">{s.title}</span>
                    </div>
                    <p className={`text-exam-ink-soft text-sm leading-relaxed ${deep.method!.numbered ? 'pr-8' : ''}`}>
                      <RichText text={s.body} />
                    </p>
                  </li>
                ))}
              </ol>
            </Card>
          )}

          {deep.layered?.map(section => (
            <section key={section.title} aria-label={section.title}>
              <h2 className="text-lg font-bold text-exam-ink mb-1">{section.title}</h2>
              {section.intro && <p className="text-exam-ink-soft text-sm leading-relaxed mb-4">{section.intro}</p>}
              <div className={`space-y-3 ${section.intro ? '' : 'mt-3'}`}>
                {section.rules.map((rule, i) => (
                  <ProgressiveRuleCard key={rule.id} rule={rule} index={i + 1} />
                ))}
              </div>
            </section>
          ))}

          {deep.questionKinds && (
            <Card title={deep.questionKinds.title}>
              <p className="text-exam-ink-soft text-sm leading-relaxed mb-4">{deep.questionKinds.intro}</p>
              <div className="space-y-4">
                {deep.questionKinds.items.map(k => (
                  <div key={k.type} className={`border p-4 rounded-sm ${KIND_CLASS[k.tone]}`}>
                    <div className="font-bold text-exam-ink text-sm mb-2">{k.type}</div>
                    <p className="text-exam-ink-soft text-sm leading-relaxed mb-2">{k.how}</p>
                    <p className="text-exam-ink-soft text-xs italic">{k.signal}</p>
                  </div>
                ))}
              </div>
            </Card>
          )}

          {deep.tips && (
            <Card title={deep.tips.title}>
              <div className="space-y-3">
                {deep.tips.items.map((t, i) => (
                  <div key={t.tip} className="bg-exam-paper-alt border border-exam-border p-4 rounded-sm">
                    <div className="flex items-start gap-2 mb-2">
                      <span className="w-5 h-5 rounded-full bg-exam-accent text-exam-accent-ink text-xs font-bold flex items-center justify-center flex-shrink-0 mt-0.5">
                        {i + 1}
                      </span>
                      <span className="font-bold text-exam-ink text-sm"><RichText text={t.tip} /></span>
                    </div>
                    <p className="text-exam-ink-soft text-xs leading-relaxed pr-7 italic"><RichText text={t.example} /></p>
                  </div>
                ))}
              </div>
            </Card>
          )}

          {deep.elimination && (
            <Card title={deep.elimination.title}>
              <p className="text-exam-ink-soft text-sm leading-relaxed mb-4">{deep.elimination.intro}</p>
              <div className="space-y-2">
                {deep.elimination.items.map(e => (
                  <div key={e.flag} className="flex items-start gap-3 p-3 bg-exam-paper-alt rounded-sm border border-exam-border">
                    <X className="w-3.5 h-3.5 text-exam-wrong flex-shrink-0 mt-0.5" strokeWidth={3} aria-hidden />
                    <div>
                      <span className="font-semibold text-exam-ink text-sm">{e.flag}: </span>
                      <span className="text-exam-ink-soft text-sm">{e.desc}</span>
                    </div>
                  </div>
                ))}
              </div>
            </Card>
          )}

          {deep.traps && (
            <Card title={deep.traps.title}>
              <div className="space-y-3">
                {deep.traps.items.map(t => (
                  <div key={t.trap} className="flex items-start gap-3 p-3 bg-exam-alt-bg rounded-sm border border-exam-alt/40">
                    <AlertTriangle className="w-4 h-4 text-exam-alt flex-shrink-0 mt-0.5" aria-hidden />
                    <div>
                      <div className="font-semibold text-exam-ink text-sm mb-1">{t.trap}</div>
                      <div className="text-exam-ink-soft text-xs leading-relaxed">{t.detail}</div>
                    </div>
                  </div>
                ))}
              </div>
            </Card>
          )}

          {deep.showTimeBudget && (
            <Card title="ניהול זמן">
              <div className="grid grid-cols-2 gap-2 mb-3">
                <div className="bg-exam-paper-alt rounded-sm px-3 py-2">
                  <div className="text-[11px] text-exam-ink-soft">{time.total}</div>
                  <div className="text-sm font-bold text-exam-ink">{time.perQ}</div>
                </div>
                <div className="bg-exam-alt-bg rounded-sm px-3 py-2">
                  <div className="text-[11px] text-exam-alt">מקסימום תקיעה</div>
                  <div className="text-sm font-bold text-exam-alt">{time.stuckCap}</div>
                </div>
              </div>
              <p className="text-exam-ink-soft text-sm leading-relaxed">{time.note}</p>
            </Card>
          )}

          {deep.ctas.map(cta => (
            <Link key={cta.href + cta.title} href={cta.href} className={`block border rounded-md p-5 transition-colors ${CTA_CLASS[cta.tone].box}`}>
              <div className="flex items-center gap-3">
                <cta.icon className={`w-7 h-7 flex-shrink-0 ${CTA_CLASS[cta.tone].icon}`} strokeWidth={1.5} aria-hidden />
                <div className="flex-1">
                  <div className="font-bold text-exam-ink text-sm">{cta.title}</div>
                  <div className="text-exam-ink-soft text-xs mt-0.5">{cta.body}</div>
                </div>
                <span className={CTA_CLASS[cta.tone].icon}>‹</span>
              </div>
            </Link>
          ))}

          <div className="text-center pb-4">
            <Link href="/tips" className="hit-44 text-sm text-exam-accent hover:opacity-80 transition-opacity">
              ← חזרה לכל האסטרטגיות
            </Link>
          </div>

        </div>
      </div>
    </div>
  );
}
