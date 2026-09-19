import Link from 'next/link';
import { UserMenu } from '@/components/UserMenu';
import { ThemeToggle } from '@/components/ThemeToggle';
import { DashboardSummaryProvider } from '@/lib/dashboard-context';
import { StreakBadge } from '@/components/home/StreakBadge';
import { HeroTagline } from '@/components/home/HeroTagline';
import { DiagnosticBanner } from '@/components/home/DiagnosticBanner';
import { ReviewQueueCard } from '@/components/home/ReviewQueueCard';
import { StatsCard } from '@/components/home/StatsCard';
import { StreakCelebration } from '@/components/home/StreakCelebration';

const LEARN_LINKS_BEFORE = [
  { href: '/practice',   icon: '✏️', title: 'תרגול ממוקד', sub: 'לפי סוג שאלה' },
  { href: '/vocabulary', icon: '📖', title: 'אוצר מילים',   sub: 'מעל 1,000 מילים' },
];
const LEARN_LINKS_AFTER = [
  { href: '/strategies', icon: '🧠', title: 'אסטרטגיות', sub: 'איך לגשת למבחן' },
];

const CARD_CLASSES = 'flex flex-col items-center gap-1.5 py-5 min-h-[112px] bg-exam-surface border border-exam-border hover:bg-exam-paper-alt hover:border-exam-border-strong rounded-md text-center transition-colors';

export default function HomePage() {
  return (
    <div className="min-h-screen bg-exam-paper flex flex-col items-center px-4 pt-4 pb-8 text-exam-ink" dir="rtl">
      <DashboardSummaryProvider>
        <StreakCelebration />
        <div className="w-full max-w-lg space-y-7">
          {/* Top bar: account + theme, in-flow (not floating) */}
          <div className="flex items-center justify-end gap-2 [&_a]:text-exam-ink-soft [&_a:hover]:text-exam-ink [&_a:hover]:bg-exam-paper-alt">
            <div className="ml-auto"><StreakBadge /></div>
            <UserMenu />
            <ThemeToggle />
          </div>

          <div className="text-center">
            <div className="text-5xl mb-3">🎓</div>
            <h1 className="text-5xl font-black mb-2 tracking-tight" dir="ltr">
              134<span className="text-exam-accent">+</span>
            </h1>
            <HeroTagline />
          </div>

          {/* Primary action */}
          <Link href="/exam" className="block w-full py-4 bg-exam-accent hover:opacity-90 rounded-md text-xl font-bold text-center text-exam-accent-ink transition-opacity">
            🎯 התחל מבחן
          </Link>

          {/* Quick diagnostic */}
          <DiagnosticBanner />

          {/* Learning & practice */}
          <section>
            <h2 className="text-sm font-semibold text-exam-ink-soft mb-2 pr-1">לימוד ותרגול</h2>
            <div className="grid grid-cols-2 gap-3">
              {LEARN_LINKS_BEFORE.map(l => (
                <Link key={l.href} href={l.href} className={CARD_CLASSES}>
                  <span className="text-3xl">{l.icon}</span>
                  <span className="font-semibold text-sm">{l.title}</span>
                  <span className="text-exam-ink-soft text-xs">{l.sub}</span>
                </Link>
              ))}
              <ReviewQueueCard />
              {LEARN_LINKS_AFTER.map(l => (
                <Link key={l.href} href={l.href} className={CARD_CLASSES}>
                  <span className="text-3xl">{l.icon}</span>
                  <span className="font-semibold text-sm">{l.title}</span>
                  <span className="text-exam-ink-soft text-xs">{l.sub}</span>
                </Link>
              ))}
            </div>
          </section>

          {/* Progress & comparison */}
          <section>
            <h2 className="text-sm font-semibold text-exam-ink-soft mb-2 pr-1">מעקב והתקדמות</h2>
            <div className="grid grid-cols-2 gap-3">
              <StatsCard />
              <Link href="/leaderboard" className={CARD_CLASSES}>
                <span className="text-3xl">🏆</span>
                <span className="font-semibold text-sm">לוח מובילים</span>
                <span className="text-exam-ink-soft text-xs">איפה אתה ביחס לכולם</span>
              </Link>
            </div>
          </section>

          {/* Tips — full-width row */}
          <Link href="/tips" className="flex items-center gap-3 p-4 bg-exam-surface border border-exam-border hover:bg-exam-paper-alt hover:border-exam-border-strong rounded-md transition-colors">
            <span className="text-2xl">💡</span>
            <div className="flex-1 text-right">
              <div className="font-semibold text-sm">טיפים אסטרטגיים לבחינה</div>
              <div className="text-exam-ink-soft text-xs">לפי סוג שאלה: השלמת משפטים, ניסוח מחדש, הבנת הנקרא</div>
            </div>
            <span className="text-exam-ink-soft">‹</span>
          </Link>

          {/* Score scale — collapsed by default to keep the page short on mobile */}
          <details className="bg-exam-surface border border-exam-border rounded-md group">
            <summary className="p-4 text-sm font-semibold text-exam-ink-soft cursor-pointer select-none list-none flex items-center justify-between">
              <span>📏 סקאלת הציונים (50–150)</span>
              <span className="text-exam-ink-soft transition-transform group-open:rotate-90">‹</span>
            </summary>
            <div className="px-5 pb-5 space-y-1.5 text-sm">
              {[
                { range: '134+', label: 'פטור מלא מאנגלית', color: 'text-exam-sage-strong' },
                { range: '120–133', label: "מתקדמים ב'", color: 'text-exam-accent' },
                { range: '100–119', label: "מתקדמים א'", color: 'text-exam-alt' },
                { range: '85–99', label: 'קורס בסיסי', color: 'text-exam-alt' },
                { range: '70–84', label: "טרום-בסיסי ב'", color: 'text-exam-wrong' },
                { range: '50–69', label: "טרום-בסיסי א'", color: 'text-exam-wrong' },
              ].map(row => (
                <div key={row.range} className="flex items-center gap-2">
                  <span className={`font-mono font-bold w-20 ${row.color}`}>{row.range}</span>
                  <span className="text-exam-ink-soft">{row.label}</span>
                </div>
              ))}
            </div>
          </details>
        </div>
      </DashboardSummaryProvider>
    </div>
  );
}
