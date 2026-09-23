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

// The two primary learning actions get a featured horizontal row (icon +
// title + subtitle), not a square tile — that visual weight is reserved
// for the live, personalized sidebar cards (StatsCard/ReviewQueueCard)
// below. Strategies moves to the quiet sidebar list since it's a static
// reference page, not a daily action.
const LEARN_LINKS = [
  { href: '/practice',   icon: PenLine,  title: 'תרגול ממוקד', sub: 'לפי סוג שאלה' },
  { href: '/vocabulary', icon: BookOpen, title: 'אוצר מילים',   sub: 'מעל 1,000 מילים' },
];

const ROW_CLASSES = 'flex items-center gap-3 p-4 bg-exam-surface border border-exam-border hover:bg-exam-paper-alt hover:border-exam-border-strong rounded-2xl shadow-surface hover:shadow-raised active:shadow-pressed transition-[background-color,border-color,box-shadow] duration-200';

export default function HomePage() {
  return (
    <div className="min-h-screen bg-exam-paper flex flex-col items-center px-4 pt-4 pb-8 text-exam-ink" dir="rtl">
      <DashboardSummaryProvider>
        <StreakCelebration />
        <div className="w-full max-w-lg lg:max-w-5xl">
          {/* Top bar: compact brand mark + account controls — the big score
              mark used to anchor the page; that role now belongs to the
              Today's Session hero below, so this stays small and quiet. */}
          <div className="flex items-center justify-between gap-2 mb-5 lg:mb-8">
            <Link href="/" className="flex items-center gap-2">
              <GraduationCap className="w-7 h-7 text-exam-ink" strokeWidth={1.5} aria-hidden />
              <span className="font-black text-xl" dir="ltr">134<span className="text-exam-accent">+</span></span>
            </Link>
            <div className="flex items-center gap-2 [&_a]:text-exam-ink-soft [&_a:hover]:text-exam-ink [&_a:hover]:bg-exam-paper-alt">
              <StreakBadge />
              <UserMenu />
              <ThemeToggle />
            </div>
          </div>

          {/* Desktop breaks out of the narrow mobile column into a wide
              hero + sidebar composition; mobile stays a single stacked
              column (the sidebar's content simply follows after, in the
              same reading order the page always had). */}
          <div className="lg:grid lg:grid-cols-[minmax(0,1fr)_336px] lg:gap-10 lg:items-start">
            {/* ── Main column: the dominant hero + primary actions ── */}
            <div className="space-y-6 lg:space-y-8">
              <HeroTagline />

              {/* HERO — Today's Session is the dominant section on the page */}
              <section>
                <h2 className="text-label text-exam-ink-soft mb-2 pr-1 flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5" aria-hidden />
                  היום שלך
                </h2>
                <TodaySessionCta />
              </section>

              {/* Secondary actions: full exam + quick diagnostic, no longer
                  competing with Today's Session for top billing */}
              <div className="grid sm:grid-cols-2 gap-3">
                <Link
                  href="/exam"
                  className="w-full py-4 px-4 bg-exam-accent hover:opacity-90 rounded-2xl shadow-raised active:shadow-pressed text-lg font-bold text-center text-exam-accent-ink transition-opacity flex items-center justify-center gap-2"
                >
                  <Target className="w-5 h-5" aria-hidden />
                  התחל מבחן מלא
                </Link>
                <DiagnosticBanner />
              </div>

              {/* Learning & practice — two featured actions, not a grid of
                  four look-alike tiles */}
              <section>
                <h2 className="text-label text-exam-ink-soft mb-2 pr-1">לימוד ותרגול</h2>
                <div className="grid sm:grid-cols-2 gap-3">
                  {LEARN_LINKS.map(l => (
                    <Link key={l.href} href={l.href} className={ROW_CLASSES}>
                      <l.icon className="w-6 h-6 text-exam-ink-soft flex-shrink-0" strokeWidth={1.75} aria-hidden />
                      <div className="flex-1 text-right min-w-0">
                        <div className="font-semibold text-sm">{l.title}</div>
                        <div className="text-exam-ink-soft text-xs">{l.sub}</div>
                      </div>
                      <ChevronLeft className="w-4 h-4 text-exam-ink-soft flex-shrink-0" aria-hidden />
                    </Link>
                  ))}
                </div>
              </section>
            </div>

            {/* ── Sidebar: live progress cards, then quiet reference links ── */}
            <aside className="space-y-6 mt-8 lg:mt-0">
              <section>
                <h2 className="text-label text-exam-ink-soft mb-2 pr-1">מעקב והתקדמות</h2>
                <div className="grid grid-cols-2 gap-3 mb-3">
                  <StatsCard />
                  <ReviewQueueCard />
                </div>
                <VictoryPathSummary />
              </section>

              <div className="space-y-3">
                <Link href="/leaderboard" className={ROW_CLASSES}>
                  <Trophy className="w-6 h-6 text-exam-ink-soft flex-shrink-0" strokeWidth={1.75} aria-hidden />
                  <div className="flex-1 text-right min-w-0">
                    <div className="font-semibold text-sm">לוח מובילים</div>
                    <div className="text-exam-ink-soft text-xs">איפה אתה ביחס לכולם</div>
                  </div>
                  <ChevronLeft className="w-4 h-4 text-exam-ink-soft flex-shrink-0" aria-hidden />
                </Link>

                <Link href="/strategies" className={ROW_CLASSES}>
                  <Brain className="w-6 h-6 text-exam-ink-soft flex-shrink-0" strokeWidth={1.75} aria-hidden />
                  <div className="flex-1 text-right min-w-0">
                    <div className="font-semibold text-sm">אסטרטגיות</div>
                    <div className="text-exam-ink-soft text-xs">איך לגשת למבחן</div>
                  </div>
                  <ChevronLeft className="w-4 h-4 text-exam-ink-soft flex-shrink-0" aria-hidden />
                </Link>

                <Link href="/tips" className={ROW_CLASSES}>
                  <Lightbulb className="w-6 h-6 text-exam-ink-soft flex-shrink-0" strokeWidth={1.75} aria-hidden />
                  <div className="flex-1 text-right min-w-0">
                    <div className="font-semibold text-sm">טיפים אסטרטגיים לבחינה</div>
                    <div className="text-exam-ink-soft text-xs">לפי סוג שאלה: השלמת משפטים, ניסוח מחדש, הבנת הנקרא</div>
                  </div>
                  <ChevronLeft className="w-4 h-4 text-exam-ink-soft flex-shrink-0" aria-hidden />
                </Link>

                {/* Score scale — collapsed by default to keep the page short */}
                <details className="bg-exam-surface border border-exam-border rounded-2xl shadow-surface group">
                  <summary className="p-4 text-sm font-semibold text-exam-ink-soft cursor-pointer select-none list-none flex items-center justify-between">
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
            </aside>
          </div>
        </div>
      </DashboardSummaryProvider>
    </div>
  );
}
