'use client';

import Link from 'next/link';
import { BackNav } from '@/components/BackNav';

const CARDS = [
  {
    href: '/tips/sentence-completion',
    icon: '✏️',
    title: 'השלמת משפטים',
    desc: 'שיטה ב-4 שלבים לבחירת המילה הנכונה בהקשר',
    accent: 'group-hover:border-blue-400',
  },
  {
    href: '/tips/restatement',
    icon: '🔁',
    title: 'ניסוח מחדש',
    desc: 'כיצד למצוא את המשפט בעל המשמעות הזהה במהירות',
    accent: 'group-hover:border-purple-400',
  },
  {
    href: '/tips/reading-comprehension',
    icon: '📖',
    title: 'הבנת הנקרא',
    desc: 'אסטרטגיית קריאה חכמה וניהול זמן לפסקאות',
    accent: 'group-hover:border-emerald-400',
  },
];

export default function TipsIndexPage() {
  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-900 flex flex-col" dir="rtl">
      <BackNav backHref="/exam" backLabel="מבחן" />
      <div className="flex-1 flex flex-col items-center px-4 py-10">
        <div className="w-full max-w-2xl">
          <div className="text-center mb-10">
            <div className="text-4xl mb-3">✨</div>
            <h1 className="text-3xl font-bold text-slate-900 dark:text-white mb-2">אסטרטגיות לפי סוג שאלה</h1>
            <p className="text-slate-500 dark:text-slate-400 text-sm leading-relaxed">
              בחר סוג שאלה כדי לקרוא טיפים, שיטות וטעויות נפוצות
            </p>
          </div>

          <div className="grid grid-cols-1 gap-4">
            {CARDS.map(card => (
              <Link
                key={card.href}
                href={card.href}
                className={`group flex items-start gap-4 p-6 bg-white dark:bg-slate-800 rounded-2xl border-2 border-slate-200 dark:border-slate-700 ${card.accent} hover:shadow-md transition-all`}
              >
                <div className="text-3xl mt-0.5">{card.icon}</div>
                <div className="flex-1">
                  <div className="text-lg font-bold text-slate-900 dark:text-white mb-1 group-hover:text-blue-700 transition-colors">
                    {card.title}
                  </div>
                  <div className="text-sm text-slate-500 dark:text-slate-400 leading-relaxed">{card.desc}</div>
                </div>
                <div className="text-slate-300 dark:text-slate-600 group-hover:text-blue-400 transition-colors text-xl self-center">
                  ←
                </div>
              </Link>
            ))}
          </div>

          <p className="text-center text-xs text-slate-400 dark:text-slate-500 mt-8">
            כל האסטרטגיות מותאמות לפורמט האמירנ&quot;ט הנוכחי
          </p>
        </div>
      </div>
    </div>
  );
}
