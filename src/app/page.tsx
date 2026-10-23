import Link from 'next/link';
import { BrandLogo } from '@/components/BrandLogo';
import { Target, PenLine, BookOpen, Brain, Sparkles } from 'lucide-react';
import { UserMenu } from '@/components/UserMenu';
import { ThemeToggle } from '@/components/ThemeToggle';
import { DashboardSummaryProvider } from '@/lib/dashboard-context';
import { StreakBadge } from '@/components/home/StreakBadge';
import { Greeting } from '@/components/home/Greeting';
import { DailySlogan } from '@/components/home/DailySlogan';
import { DiagnosticBanner } from '@/components/home/DiagnosticBanner';
import { ReviewQueueCard } from '@/components/home/ReviewQueueCard';
import { StatsCard } from '@/components/home/StatsCard';
import { StreakCelebration } from '@/components/home/StreakCelebration';
import { GoalMetCelebration } from '@/components/home/GoalMetCelebration';
import { DailyGoalPrompt } from '@/components/home/DailyGoalPrompt';
import { TodaySessionCta } from '@/components/home/TodaySessionCta';
import { ExamDateCard } from '@/components/home/ExamDateCard';
import { OfficialScorePrompt } from '@/components/home/OfficialScorePrompt';
import { ICON_TILE, SQUARE_LINK } from '@/components/home/surfaces';

const LEARN_LINKS_BEFORE = [
  { href: '/practice',   icon: PenLine,  title: 'תרגול ממוקד', sub: 'לפי סוג שאלה' },
  { href: '/vocabulary', icon: BookOpen, title: 'אוצר מילים',   sub: 'מעל 1,000 מילים' },
];
const LEARN_LINKS_AFTER = [
  { href: '/strategies', icon: Brain, title: 'אסטרטגיות', sub: 'איך לגשת למבחן' },
];

const HEADING = 'mt-[30px] mb-2.5 px-0.5 flex items-center gap-1.5 text-lg font-extrabold tracking-[-0.015em] text-exam-ink';

function LearnTile({ href, icon: Icon, title, sub }: (typeof LEARN_LINKS_BEFORE)[number]) {
  return (
    <Link href={href} className={SQUARE_LINK}>
      <span className={`${ICON_TILE} size-11 mb-1.5`}><Icon className="w-[22px] h-[22px]" strokeWidth={1.75} aria-hidden /></span>
      <span className="font-bold text-[15px] tracking-[-0.01em]">{title}</span>
      <span className="text-exam-ink-soft text-xs">{sub}</span>
    </Link>
  );
}

export default function HomePage() {
  return (
    <main id="main" className="min-h-dvh overflow-x-clip bg-exam-paper flex flex-col items-center px-4 pt-3.5 pb-8 text-exam-ink" dir="rtl">
      <DashboardSummaryProvider>
        <StreakCelebration />
        <GoalMetCelebration />
        <div className="w-full max-w-lg">
          {/* Top bar: account + theme, in-flow (not floating) */}
          <div className="flex items-center justify-end gap-2 [&_a]:text-exam-ink-soft [&_a:hover]:text-exam-ink [&_a:hover]:bg-exam-paper-alt">
            <div className="ml-auto"><StreakBadge /></div>
            <UserMenu />
            <ThemeToggle />
          </div>

          {/* Hero: the mark, a greeting by name, then the day's slogan */}
          <div className="mt-[18px] text-center">
            <h1>
              <BrandLogo className="w-[136px] h-auto mx-auto" />
              <span className="sr-only">: הכנה לאמירנ&quot;ט</span>
            </h1>
            <Greeting />
            <DailySlogan />
          </div>

          <div className="mt-[26px] flex flex-col gap-3.5">
            {/* Exam date — prompts for it while unset (the spaced-repetition
                scheduler times every review to it), then a quiet countdown.
                Once the date has passed, the same slot asks for the official
                score instead (the two never show together). */}
            <div className="empty:hidden"><ExamDateCard /><OfficialScorePrompt /></div>
            <div className="empty:hidden"><DailyGoalPrompt /></div>

            {/* Primary action — the one raised, navy-shadowed control on the page */}
            <Link
              href="/exam"
              className="w-full h-[60px] bg-exam-accent text-exam-accent-ink rounded-[20px] shadow-stats-hero hover:brightness-110 active:shadow-pressed active:scale-[0.98] text-xl font-extrabold tracking-[-0.01em] flex items-center justify-center gap-2.5 transition-[filter,box-shadow,transform] duration-300 ease-spring will-change-transform"
            >
              <Target className="w-[22px] h-[22px]" strokeWidth={2.25} aria-hidden />
              התחל מבחן
            </Link>
          </div>

          {/* Today: what was done today, what's left of the plan, and the way into it. */}
          <section>
            <h2 className={HEADING}>
              <Sparkles className="w-4 h-4 text-exam-sage" aria-hidden />
              היום שלך
            </h2>
            <TodaySessionCta />
          </section>

          {/* Quick diagnostic, until a first exam has measured the student */}
          <div className="mt-4 empty:hidden"><DiagnosticBanner /></div>

          {/* Learning & practice — classic 2x2 grid */}
          <section>
            <h2 className={HEADING}>לימוד ותרגול</h2>
            <div className="grid grid-cols-2 gap-3">
              {LEARN_LINKS_BEFORE.map(l => <LearnTile key={l.href} {...l} />)}
              <ReviewQueueCard />
              {LEARN_LINKS_AFTER.map(l => <LearnTile key={l.href} {...l} />)}
            </div>
          </section>

          {/* Progress */}
          <section>
            <h2 className={HEADING}>מעקב והתקדמות</h2>
            <StatsCard />
          </section>
        </div>
      </DashboardSummaryProvider>
    </main>
  );
}
