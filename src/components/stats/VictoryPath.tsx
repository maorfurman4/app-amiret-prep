'use client';

import { useMemo } from 'react';
import {
  Line, LineChart, XAxis, YAxis, CartesianGrid, ReferenceLine, Tooltip, ResponsiveContainer,
} from 'recharts';
import { TrendingUp } from 'lucide-react';
import { computeForecast, type ForecastSession } from '@/lib/forecast';

interface VictoryPathProps {
  sessions: ForecastSession[];
  targetScore?: number;
}

interface ChartPoint {
  date: string;
  actual?: number;
  projected?: number;
}

const MOMENTUM_WINDOW = 5;

function formatDateShort(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString('he-IL', { day: 'numeric', month: 'short' });
}

/**
 * Recharts is a real (already-installed, previously unused) dependency —
 * this is its first consumer. First-party consumer of src/lib/forecast.ts:
 * a calendar-day-based projection (not exams-based) of when the student
 * will reach their target score, rendered as an actual-vs-projected line
 * with a target reference line. Below the trust guardrail in forecast.ts
 * (fewer than 4 exams or fewer than 3 distinct days), this renders an
 * honest "not enough data yet" state instead of guessing from noise.
 */
export function VictoryPath({ sessions, targetScore = 134 }: VictoryPathProps) {
  const forecast = useMemo(() => computeForecast(sessions, targetScore), [sessions, targetScore]);

  // Momentum idea: if the last 5 exams are trending steeper than the
  // all-time trend, the projected line renders in exam-sage ("accelerating")
  // instead of the neutral accent — a quiet color shift instead of a badge.
  const recentForecast = useMemo(
    () => computeForecast(sessions.slice(-MOMENTUM_WINDOW), targetScore),
    [sessions, targetScore],
  );
  const accelerating = !!(forecast && recentForecast && recentForecast.slopePerDay > forecast.slopePerDay * 1.15);

  if (!forecast) {
    const remaining = Math.max(0, 4 - sessions.length);
    return (
      <div className="bg-exam-surface rounded-2xl shadow-surface hover:shadow-raised transition-shadow duration-300 ease-spring border border-exam-border p-5 animate-fade-up">
        <h2 className="font-bold text-exam-ink mb-1 flex items-center gap-2">
          <TrendingUp className="w-4 h-4" aria-hidden />
          מסלול הניצחון
        </h2>
        <p className="text-sm text-exam-ink-soft">
          {remaining > 0
            ? `עוד ${remaining} ${remaining === 1 ? 'מבחן' : 'מבחנים'} כדי לחשב תחזית אמינה — התחזית מבוססת על קצב אמיתי לאורך זמן, לא ניחוש`
            : 'עוד קצת — צריך מבחנים פרושים על פני כמה ימים שונים כדי לחשב תחזית אמינה'}
        </p>
      </div>
    );
  }

  const sorted = [...sessions].sort((a, b) => a.completed_at.localeCompare(b.completed_at));
  const data: ChartPoint[] = sorted.map(s => ({ date: s.completed_at.slice(0, 10), actual: s.score }));

  if (forecast.projectedDate && forecast.daysToTarget !== null && forecast.daysToTarget > 0) {
    // Bridge point so the dashed projection visually continues from
    // exactly where the solid actual line ends, not a disconnected segment.
    const last = data[data.length - 1];
    data[data.length - 1] = { ...last, projected: last.actual };
    data.push({ date: forecast.projectedDate, projected: targetScore });
  }

  const yMin = Math.min(50, ...sorted.map(s => s.score), targetScore) - 5;
  const yMax = Math.max(150, ...sorted.map(s => s.score), targetScore) + 5;

  return (
    <div className="bg-exam-surface rounded-2xl shadow-raised hover:shadow-overlay transition-shadow duration-300 ease-spring border border-exam-border p-5 animate-fade-up">
      <h2 className="font-bold text-exam-ink mb-1 flex items-center gap-2">
        <TrendingUp className="w-4 h-4" aria-hidden />
        מסלול הניצחון
      </h2>
      <p className="text-sm text-exam-ink-soft mb-4">
        {forecast.daysToTarget === 0 ? (
          <>הגעת ליעד — <span className="font-bold text-exam-sage-strong">{targetScore}+</span> כבר בכיס</>
        ) : (
          <>
            בקצב הנוכחי שלך (<span className="font-bold text-exam-ink tabular-nums">+{forecast.slopePerDay.toFixed(1)}</span> נק׳ ליום):
            {' '}צפוי להגיע ל-<span className="font-bold text-exam-ink tabular-nums">{targetScore}</span> בעוד כ-
            <span className={`font-bold tabular-nums ${accelerating ? 'text-exam-sage-strong' : 'text-exam-ink'}`}>{' '}{forecast.daysToTarget} ימים</span>
            {accelerating && ' — ומאיץ 🚀'}
          </>
        )}
      </p>
      <div className="h-56" dir="ltr">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="currentColor" className="text-exam-border" vertical={false} />
            <XAxis
              dataKey="date"
              tickFormatter={formatDateShort}
              tick={{ fontSize: 10, fill: 'currentColor' }}
              className="text-exam-ink-soft"
              axisLine={{ stroke: 'currentColor' }}
              tickLine={false}
            />
            <YAxis
              domain={[yMin, yMax]}
              tick={{ fontSize: 10, fill: 'currentColor' }}
              className="text-exam-ink-soft"
              axisLine={false}
              tickLine={false}
              width={32}
            />
            <Tooltip
              labelFormatter={label => formatDateShort(String(label))}
              formatter={(value, name) => [Math.round(Number(value)), name === 'actual' ? 'ציון' : 'תחזית']}
              contentStyle={{ fontSize: 12, direction: 'rtl', background: 'var(--exam-surface)', border: '1px solid var(--exam-border)', borderRadius: 6 }}
            />
            <ReferenceLine
              y={targetScore}
              stroke="currentColor"
              className="text-exam-sage"
              strokeDasharray="4 4"
              strokeLinecap="round"
              label={{ value: String(targetScore), position: 'insideTopLeft', fontSize: 10, fill: 'currentColor' }}
            />
            <Line
              type="monotone"
              dataKey="actual"
              stroke="currentColor"
              className="text-exam-accent"
              strokeWidth={2.5}
              strokeLinecap="round"
              strokeLinejoin="round"
              dot={{ r: 3.5, strokeWidth: 0, fill: 'currentColor' }}
              activeDot={{ r: 5, strokeWidth: 2, stroke: 'var(--exam-surface)' }}
              style={{ filter: 'drop-shadow(0 0 3px currentColor)' }}
              connectNulls
              isAnimationActive={false}
            />
            <Line
              type="monotone"
              dataKey="projected"
              stroke="currentColor"
              className={accelerating ? 'text-exam-sage-strong' : 'text-exam-accent'}
              strokeWidth={2}
              strokeDasharray="6 4"
              strokeLinecap="round"
              strokeLinejoin="round"
              dot={false}
              style={{ filter: 'drop-shadow(0 0 3px currentColor)' }}
              connectNulls
              isAnimationActive={false}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
