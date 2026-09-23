import Link from 'next/link';
import { GraduationCap, Target, PenLine, BookOpen, Brain, Trophy, Lightbulb, Ruler, ChevronLeft, Sparkles } from 'lucide-react';
import { UserMenu } from '@/components/UserMenu';
import { ThemeToggle } from '@/components/ThemeToggle';
import { DashboardSummaryProvider } from '@/lib/dashboard-context';
import { StreakBadge } from '@/components/home/StreakBadge';
import { HeroTagline } from '@/components/home/HeroTagline';
import { DiagnosticBanner } from '@/components/home/DiagnosticBanner';
import { ReviewQueueCard } from '@/components/home/ReviewQueueCard';
import { StatsCard } from '@/components/home/StatsCard';
import { StreakCelebration } from '@/components/home/StreakCelebration';
import { TodaySessionCta } from '@/components/home/TodaySessionCta';
import { VictoryPathSummary } from '@/components/home/VictoryPathSummary';

const LEARN_LINKS_BEFORE = [
  { href: '/practice',   icon: PenLine,  title: 'תרגול ממוקד', sub: 'לפי סוג שאלה' },
  { href: '/vocabulary', icon: BookOpen, title: 'אוצר מילים',   sub: 'מעל 1,000 מילים' },
];
const LEARN_LINKS_AFTER = [
  { href: '/strategies', icon: Brain, title: 'אסטרטגיות', sub: 'איך לגשת למבחן' },
];

// Classic square tile — same tactile lifecycle (hover lift + expanding
// shadow, press settles with an inset shadow) as every other interactive
// element on the page, just in the original 2x2 grid shape rather than a
// full-width row.
const CARD_CLASSES = 'flex flex-col items-center gap-1.5 py-5 min-h-[112px] bg-exam-surface border border-exam-border hover:bg-exam-paper-alt hover:border-exam-border-strong rounded-2xl shadow-surface hover:shadow-raised active:shadow-pressed hover:-translate-y-1 active:translate-y-0 active:scale-[0.97] text-center transition-[background-color,border-color,box-shadow,transform] duration-300 ease-spring will-change-transform';

export default function HomePage() {
  return (
    <div className="min-h-screen bg-exam-paper flex flex-col items-center px-4 pt-4 pb-8 text-exam-ink" dir="rtl">
      <DashboardSummaryProvider>
        <StreakCelebration />
        <div className="w-full max-w-lg space-y-7">
          {/* Top bar: account + theme, in-flow (not floating) */}
          <div className="flex items-center justify-end gap-2 animate-fade-up [&_a]:text-exam-ink-soft [&_a:hover]:text-exam-ink [&_a:hover]:bg-exam-paper-alt">
            <div className="ml-auto"><StreakBadge /></div>
            <UserMenu />
            <ThemeToggle />
          </div>

          {/* Hero — the big score mark anchors the page again */}
          <div className="text-center animate-fade-up [animation-delay:60ms]">
            <GraduationCap className="w-12 h-12 mx-auto mb-3 text-exam-ink" strokeWidth={1.5} aria-hidden />
            <h1 className="text-display mb-2" dir="ltr">
              134<span className="text-exam-accent">+</span>
            </h1>
            <HeroTagline />
          </div>

          {/* Primary action */}
          <Link
            href="/exam"
            className="w-full py-4 bg-exam-accent hover:opacity-90 rounded-2xl shadow-raised hover:shadow-overlay active:shadow-pressed hover:-translate-y-1 active:translate-y-0 active:scale-[0.97] text-xl font-bold text-center text-exam-accent-ink transition-[opacity,box-shadow,transform] duration-300 ease-spring will-change-transform flex items-center justify-center gap-2 animate-fade-up [animation-delay:120ms]"
          >
            <Target className="w-5 h-5" aria-hidden />
            התחל מבחן
          </Link>

          {/* Today's session — spaced-repetition vocab + due review + weak-area
              practice. Right under the primary exam CTA, ahead of everything
              else, so it's the first thing after "start a full exam". */}
          <section className="animate-fade-up [animation-delay:180ms]">
            <h2 className="text-label text-exam-ink-soft mb-2 pr-1 flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5" aria-hidden />
              היום שלך
            </h2>
            <TodaySessionCta />
          </section>

          {/* Quick diagnostic */}
          <div className="animate-fade-up [animation-delay:240ms]"><DiagnosticBanner /></div>

          {/* Learning & practice — classic 2x2 grid */}
          <section className="animate-fade-up [animation-delay:300ms]">
            <h2 className="text-label text-exam-ink-soft mb-2 pr-1">לימוד ותרגול</h2>
            <div className="grid grid-cols-2 gap-3">
              {LEARN_LINKS_BEFORE.map(l => (
                <Link key={l.href} href={l.href} className={CARD_CLASSES}>
                  <l.icon className="w-7 h-7 text-exam-ink-soft" strokeWidth={1.75} aria-hidden />
                  <span className="font-semibold text-sm">{l.title}</span>
                  <span className="text-exam-ink-soft text-xs">{l.sub}</span>
                </Link>
              ))}
              <ReviewQueueCard />
              {LEARN_LINKS_AFTER.map(l => (
                <Link key={l.href} href={l.href} className={CARD_CLASSES}>
                  <l.icon className="w-7 h-7 text-exam-ink-soft" strokeWidth={1.75} aria-hidden />
                  <span className="font-semibold text-sm">{l.title}</span>
                  <span className="text-exam-ink-soft text-xs">{l.sub}</span>
                </Link>
              ))}
            </div>
          </section>

          {/* Progress & comparison */}
          <section className="animate-fade-up [animation-delay:360ms]">
            <h2 className="text-label text-exam-ink-soft mb-2 pr-1">מעקב והתקדמות</h2>
            <div className="grid grid-cols-2 gap-3">
              <StatsCard />
              <Link href="/leaderboard" className={CARD_CLASSES}>
                <Trophy className="w-7 h-7 text-exam-ink-soft" strokeWidth={1.75} aria-hidden />
                <span className="font-semibold text-sm">לוח מובילים</span>
                <span className="text-exam-ink-soft text-xs">איפה אתה ביחס לכולם</span>
              </Link>
            </div>
            <div className="mt-3"><VictoryPathSummary /></div>
          </section>

          {/* Tips — full-width row */}
          <Link
            href="/tips"
            className="flex items-center gap-3 p-4 bg-exam-surface border border-exam-border hover:bg-exam-paper-alt hover:border-exam-border-strong rounded-2xl shadow-surface hover:shadow-raised active:shadow-pressed hover:-translate-y-1 active:translate-y-0 active:scale-[0.98] transition-[background-color,border-color,box-shadow,transform] duration-300 ease-spring will-change-transform animate-fade-up [animation-delay:420ms]"
          >
            <Lightbulb className="w-6 h-6 text-exam-ink-soft flex-shrink-0" strokeWidth={1.75} aria-hidden />
            <div className="flex-1 text-right">
              <div className="font-semibold text-sm">טיפים אסטרטגיים לבחינה</div>
              <div className="text-exam-ink-soft text-xs">לפי סוג שאלה: השלמת משפטים, ניסוח מחדש, הבנת הנקרא</div>
            </div>
            <ChevronLeft className="w-4 h-4 text-exam-ink-soft flex-shrink-0" aria-hidden />
          </Link>

          {/* Score scale — collapsed by default to keep the page short on mobile */}
          <details className="bg-exam-surface border border-exam-border rounded-2xl shadow-surface group animate-fade-up [animation-delay:480ms]">
            <summary className="p-4 text-sm font-semibold text-exam-ink-soft cursor-pointer select-none list-none flex items-center justify-between rounded-2xl hover:bg-exam-paper-alt transition-colors duration-300 ease-spring">
              <span className="flex items-center gap-2">
                <Ruler className="w-4 h-4" aria-hidden />
                סקאלת הציונים (50–150)
              </span>
              <ChevronLeft className="w-4 h-4 text-exam-ink-soft transition-transform group-open:-rotate-90" aria-hidden />
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
