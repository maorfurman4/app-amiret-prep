import Link from 'next/link';
import { UserMenu } from '@/components/UserMenu';
import { ThemeToggle } from '@/components/ThemeToggle';

const LEARN_LINKS = [
  { href: '/practice',     icon: '✏️', title: 'תרגול ממוקד',   sub: 'לפי סוג שאלה' },
  { href: '/vocabulary',   icon: '📖', title: 'אוצר מילים',     sub: 'מעל 1,000 מילים' },
  { href: '/review-queue', icon: '🔄', title: 'חזרה חכמה',      sub: 'שאלות שטעית בהן' },
  { href: '/strategies',   icon: '🧠', title: 'אסטרטגיות',      sub: 'איך לגשת למבחן' },
];

const TRACK_LINKS = [
  { href: '/stats',       icon: '📊', title: 'הסטטיסטיקה שלי', sub: 'היסטוריה וגרפים' },
  { href: '/leaderboard', icon: '🏆', title: 'לוח מובילים',     sub: 'איפה אתה ביחס לכולם' },
];

const CARD_CLASSES = 'flex flex-col items-center gap-1.5 py-5 min-h-[112px] bg-white shadow-sm border border-slate-200 hover:bg-slate-50 active:bg-slate-100 dark:bg-white/10 dark:shadow-none dark:border-transparent dark:hover:bg-white/20 dark:active:bg-white/25 rounded-2xl text-center transition-colors';

export default function HomePage() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-100 to-slate-50 dark:from-slate-900 dark:to-slate-800 flex flex-col items-center px-4 pt-4 pb-8 text-slate-900 dark:text-white" dir="rtl">
      <div className="w-full max-w-lg space-y-7">
        {/* Top bar: account + theme, in-flow (not floating) */}
        <div className="flex items-center justify-end gap-2 [&_a]:text-slate-600 [&_a:hover]:text-slate-900 [&_a:hover]:bg-slate-200/60 dark:[&_a]:text-slate-200 dark:[&_a:hover]:text-white dark:[&_a:hover]:bg-white/10">
          <UserMenu />
          <ThemeToggle />
        </div>

        <div className="text-center">
          <div className="text-5xl mb-3">🎓</div>
          <h1 className="text-5xl font-black mb-2 tracking-tight" dir="ltr">
            134<span className="text-blue-500 dark:text-blue-400">+</span>
          </h1>
          <p className="text-slate-600 dark:text-slate-300">ההכנה המדויקת ביותר לאמירנ&quot;ט — בדרך לפטור</p>
        </div>

        {/* Primary action */}
        <Link href="/exam" className="block w-full py-4 bg-blue-500 hover:bg-blue-400 active:bg-blue-600 rounded-2xl text-xl font-bold text-center text-white transition-colors shadow-lg shadow-blue-500/30 dark:shadow-blue-900/40">
          🎯 התחל מבחן
        </Link>

        {/* Quick diagnostic */}
        <Link href="/diagnostic" className="flex items-center gap-3 p-4 -mt-3 bg-white shadow-sm border border-slate-200 hover:bg-slate-50 active:bg-slate-100 dark:bg-white/10 dark:shadow-none dark:border-transparent dark:hover:bg-white/20 dark:active:bg-white/25 rounded-2xl transition-colors">
          <span className="text-2xl">🩺</span>
          <div className="flex-1 text-right">
            <div className="font-semibold text-sm">לא יודע מאיפה להתחיל? אבחון רמה מהיר</div>
            <div className="text-slate-500 dark:text-slate-400 text-xs">12 שאלות אדפטיביות · ~10 דקות · רמה + תוכנית מותאמת</div>
          </div>
          <span className="text-slate-400">‹</span>
        </Link>

        {/* Learning & practice */}
        <section>
          <h2 className="text-sm font-semibold text-slate-500 dark:text-slate-400 mb-2 pr-1">לימוד ותרגול</h2>
          <div className="grid grid-cols-2 gap-3">
            {LEARN_LINKS.map(l => (
              <Link key={l.href} href={l.href} className={CARD_CLASSES}>
                <span className="text-3xl">{l.icon}</span>
                <span className="font-semibold text-sm">{l.title}</span>
                <span className="text-slate-500 dark:text-slate-400 text-xs">{l.sub}</span>
              </Link>
            ))}
          </div>
        </section>

        {/* Progress & comparison */}
        <section>
          <h2 className="text-sm font-semibold text-slate-500 dark:text-slate-400 mb-2 pr-1">מעקב והתקדמות</h2>
          <div className="grid grid-cols-2 gap-3">
            {TRACK_LINKS.map(l => (
              <Link key={l.href} href={l.href} className={CARD_CLASSES}>
                <span className="text-3xl">{l.icon}</span>
                <span className="font-semibold text-sm">{l.title}</span>
                <span className="text-slate-500 dark:text-slate-400 text-xs">{l.sub}</span>
              </Link>
            ))}
          </div>
        </section>

        {/* Tips — full-width row */}
        <Link href="/tips" className="flex items-center gap-3 p-4 bg-white shadow-sm border border-slate-200 hover:bg-slate-50 active:bg-slate-100 dark:bg-white/10 dark:shadow-none dark:border-transparent dark:hover:bg-white/20 dark:active:bg-white/25 rounded-2xl transition-colors">
          <span className="text-2xl">💡</span>
          <div className="flex-1 text-right">
            <div className="font-semibold text-sm">טיפים אסטרטגיים לבחינה</div>
            <div className="text-slate-500 dark:text-slate-400 text-xs">לפי סוג שאלה: השלמת משפטים, ניסוח מחדש, הבנת הנקרא</div>
          </div>
          <span className="text-slate-400">‹</span>
        </Link>

        {/* Score scale — collapsed by default to keep the page short on mobile */}
        <details className="bg-white shadow-sm border border-slate-200 dark:bg-white/5 dark:shadow-none dark:border-transparent rounded-2xl group">
          <summary className="p-4 text-sm font-semibold text-slate-600 dark:text-slate-300 cursor-pointer select-none list-none flex items-center justify-between">
            <span>📏 סקאלת הציונים (50–150)</span>
            <span className="text-slate-400 dark:text-slate-500 transition-transform group-open:rotate-90">‹</span>
          </summary>
          <div className="px-5 pb-5 space-y-1.5 text-sm">
            {[
              { range: '134+', label: 'פטור מלא מאנגלית', color: 'text-green-600 dark:text-green-400' },
              { range: '120–133', label: "מתקדמים ב'", color: 'text-blue-600 dark:text-blue-400' },
              { range: '100–119', label: "מתקדמים א'", color: 'text-yellow-600 dark:text-yellow-400' },
              { range: '85–99', label: 'קורס בסיסי', color: 'text-orange-600 dark:text-orange-400' },
              { range: '70–84', label: "טרום-בסיסי ב'", color: 'text-red-500 dark:text-red-400' },
              { range: '50–69', label: "טרום-בסיסי א'", color: 'text-red-600 dark:text-red-500' },
            ].map(row => (
              <div key={row.range} className="flex items-center gap-2">
                <span className={`font-mono font-bold w-20 ${row.color}`}>{row.range}</span>
                <span className="text-slate-600 dark:text-slate-300">{row.label}</span>
              </div>
            ))}
          </div>
        </details>
      </div>
    </div>
  );
}
