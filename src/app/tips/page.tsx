'use client';

import Link from 'next/link';
import { Sparkles } from 'lucide-react';
import { BackNav } from '@/components/BackNav';
import { QUESTION_GUIDES } from '@/data/strategies';

const CARDS = QUESTION_GUIDES.map(g => ({ href: g.tipsHref, icon: g.icon, title: g.titleHe, desc: g.deep.cardDesc }));

export default function TipsIndexPage() {
  return (
    <div className="min-h-dvh bg-exam-paper flex flex-col" dir="rtl">
      <BackNav backHref="/exam" backLabel="מבחן" />
      <div className="flex-1 flex flex-col items-center px-4 py-10">
        <div className="w-full max-w-2xl">
          <div className="text-center mb-10">
            <Sparkles className="w-9 h-9 mx-auto mb-3 text-exam-ink" strokeWidth={1.5} aria-hidden />
            <h1 className="text-3xl font-bold text-exam-ink mb-2">אסטרטגיות לפי סוג שאלה</h1>
            <p className="text-exam-ink-soft text-sm leading-relaxed">
              בחר סוג שאלה כדי לקרוא טיפים, שיטות וטעויות נפוצות
            </p>
          </div>

          <div className="grid grid-cols-1 gap-4">
            {CARDS.map(card => (
              <Link
                key={card.href}
                href={card.href}
                className="group flex items-start gap-4 p-6 bg-exam-surface rounded-md border border-exam-border hover:bg-exam-paper-alt hover:border-exam-border-strong transition-colors"
              >
                <card.icon className="w-7 h-7 mt-0.5 text-exam-ink-soft flex-shrink-0" strokeWidth={1.5} aria-hidden />
                <div className="flex-1">
                  <div className="text-lg font-bold text-exam-ink mb-1">
                    {card.title}
                  </div>
                  <div className="text-sm text-exam-ink-soft leading-relaxed">{card.desc}</div>
                </div>
                <div className="text-exam-ink-soft group-hover:text-exam-accent transition-colors text-xl self-center">
                  ←
                </div>
              </Link>
            ))}
          </div>

          <p className="text-center text-xs text-exam-ink-soft mt-8">
            כל האסטרטגיות מותאמות לפורמט האמירנ&quot;ט הנוכחי
          </p>
        </div>
      </div>
    </div>
  );
}
