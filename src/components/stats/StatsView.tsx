import Link from 'next/link';
import { BarChart3 } from 'lucide-react';
import type { StatsMetrics, StatsRow } from '@/lib/stats-metrics';
import type { StatsActivity } from '@/lib/stats-client';
import { BackNav } from '@/components/BackNav';
import { OfficialScoresSection } from '@/components/official-score/OfficialScoresSection';
import { StatsHero } from './StatsHero';
import { ReadinessSection } from './ReadinessSection';
import { TypePerformanceCard } from './TypePerformanceCard';
import { PracticeActivityCard } from './PracticeActivityCard';
import { ErrorCauseCard } from './ErrorCauseCard';
import { VictoryPath } from './VictoryPath';

/**
 * The loaded screen. Split out so it can be rendered (and tested) from metrics
 * alone. `activity` (practice counts + tagged errors) is an optional add-on —
 * its widgets simply don't render until it's loaded.
 */
export function StatsView({ metrics, rows, activity }: { metrics: StatsMetrics | null; rows: StatsRow[]; activity?: StatsActivity | null }) {
  if (!metrics) {
    return (
      <div className="min-h-dvh bg-exam-paper" dir="rtl">
        <BackNav backHref="/exam" backLabel="מבחן" />
        <main id="main" className="flex flex-col items-center justify-center h-[calc(100dvh-3rem)] text-center px-4">
          <BarChart3 className="w-14 h-14 mx-auto mb-4 text-exam-ink-soft" strokeWidth={1.5} aria-hidden />
          <h1 className="text-2xl font-bold text-exam-ink mb-2">הסטטיסטיקה שלך מחכה למבחן הראשון</h1>
          <p className="text-exam-ink-soft mb-6">אחרי סימולציה אחת תראה כאן את הציון שלך, את החוזקות ואת מה שכדאי לחזק.</p>
          <Link href="/exam" className="px-6 py-3 bg-exam-accent text-exam-accent-ink rounded-2xl shadow-raised hover:shadow-overlay active:shadow-pressed hover:-translate-y-1 active:translate-y-0 active:scale-[0.98] font-semibold transition-[box-shadow,transform] duration-300 ease-spring will-change-transform">
            התחל מבחן
          </Link>
        </main>
        {/* Someone who already sat the real test can report it before any exam here. */}
        <div className="max-w-2xl mx-auto px-4 pb-24">
          <OfficialScoresSection />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-dvh bg-exam-paper" dir="rtl">
      <BackNav backHref="/exam" backLabel="מבחן" />
      {/* Three depths on purpose: the score panel raised, the trend flat on the page, the types recessed. */}
      <main id="main" className="max-w-2xl mx-auto flex flex-col gap-7 pt-5 pb-24 px-4">
        <h1 className="text-2xl font-bold text-exam-ink -mb-3">הסטטיסטיקה שלי</h1>
        <StatsHero metrics={metrics} />
        {activity && <PracticeActivityCard practice={activity.practice} />}
        <VictoryPath sessions={rows} targetScore={134} />
        <TypePerformanceCard recent={metrics.recent} allTime={metrics.allTime} weakestType={metrics.weakest?.type ?? null} />
        {activity && <ErrorCauseCard breakdown={activity.errorCauses} />}
        <ReadinessSection metrics={metrics} />
        <OfficialScoresSection />
      </main>
    </div>
  );
}
