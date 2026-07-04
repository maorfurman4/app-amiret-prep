import Link from 'next/link';

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

export default function HomePage() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-900 to-slate-800 flex flex-col items-center px-4 pt-14 pb-8 text-white" dir="rtl">
      <div className="w-full max-w-lg space-y-7">
        <div className="text-center">
          <div className="text-5xl mb-3">🎓</div>
          <h1 className="text-4xl font-black mb-2">הכנה לאמירנ&quot;ט</h1>
          <p className="text-slate-300">פלטפורמת ההכנה המדוייקת ביותר לציון הטוב ביותר</p>
        </div>

        {/* Primary action */}
        <Link href="/exam" className="block w-full py-4 bg-blue-500 hover:bg-blue-400 active:bg-blue-600 rounded-2xl text-xl font-bold text-center transition-colors shadow-lg shadow-blue-900/40">
          🎯 התחל מבחן
        </Link>

        {/* Learning & practice */}
        <section>
          <h2 className="text-sm font-semibold text-slate-400 mb-2 pr-1">לימוד ותרגול</h2>
          <div className="grid grid-cols-2 gap-3">
            {LEARN_LINKS.map(l => (
              <Link key={l.href} href={l.href} className="flex flex-col items-center gap-1.5 py-5 min-h-[112px] bg-white/10 hover:bg-white/20 active:bg-white/25 rounded-2xl text-center transition-colors">
                <span className="text-3xl">{l.icon}</span>
                <span className="font-semibold text-sm">{l.title}</span>
                <span className="text-slate-400 text-xs">{l.sub}</span>
              </Link>
            ))}
          </div>
        </section>

        {/* Progress & comparison */}
        <section>
          <h2 className="text-sm font-semibold text-slate-400 mb-2 pr-1">מעקב והתקדמות</h2>
          <div className="grid grid-cols-2 gap-3">
            {TRACK_LINKS.map(l => (
              <Link key={l.href} href={l.href} className="flex flex-col items-center gap-1.5 py-5 min-h-[112px] bg-white/10 hover:bg-white/20 active:bg-white/25 rounded-2xl text-center transition-colors">
                <span className="text-3xl">{l.icon}</span>
                <span className="font-semibold text-sm">{l.title}</span>
                <span className="text-slate-400 text-xs">{l.sub}</span>
              </Link>
            ))}
          </div>
        </section>

        {/* Tips — full-width row */}
        <Link href="/tips" className="flex items-center gap-3 p-4 bg-white/10 hover:bg-white/20 active:bg-white/25 rounded-2xl transition-colors">
          <span className="text-2xl">💡</span>
          <div className="flex-1 text-right">
            <div className="font-semibold text-sm">טיפים אסטרטגיים לבחינה</div>
            <div className="text-slate-400 text-xs">לפי סוג שאלה: השלמת משפטים, ניסוח מחדש, הבנת הנקרא</div>
          </div>
          <span className="text-slate-400">‹</span>
        </Link>

        {/* Score scale — collapsed by default to keep the page short on mobile */}
        <details className="bg-white/5 rounded-2xl group">
          <summary className="p-4 text-sm font-semibold text-slate-300 cursor-pointer select-none list-none flex items-center justify-between">
            <span>📏 סקאלת הציונים (50–150)</span>
            <span className="text-slate-500 transition-transform group-open:rotate-90">‹</span>
          </summary>
          <div className="px-5 pb-5 space-y-1.5 text-sm">
            {[
              { range: '134+', label: 'פטור מלא מאנגלית', color: 'text-green-400' },
              { range: '120–133', label: "מתקדמים ב'", color: 'text-blue-400' },
              { range: '100–119', label: "מתקדמים א'", color: 'text-yellow-400' },
              { range: '85–99', label: 'קורס בסיסי', color: 'text-orange-400' },
              { range: '70–84', label: "טרום-בסיסי ב'", color: 'text-red-400' },
              { range: '50–69', label: "טרום-בסיסי א'", color: 'text-red-500' },
            ].map(row => (
              <div key={row.range} className="flex items-center gap-2">
                <span className={`font-mono font-bold w-20 ${row.color}`}>{row.range}</span>
                <span className="text-slate-300">{row.label}</span>
              </div>
            ))}
          </div>
        </details>
      </div>
    </div>
  );
}
