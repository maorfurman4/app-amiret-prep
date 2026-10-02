'use client';

import { useMemo } from 'react';
import {
  Line, LineChart, XAxis, YAxis, CartesianGrid, ReferenceLine, Tooltip, ResponsiveContainer,
} from 'recharts';
import { TrendingUp } from 'lucide-react';
import { computeTrend, MIN_MEANINGFUL_SLOPE, MIN_SESSIONS, type TrendSession } from '@/lib/trend';
import { heCount } from '@/lib/hebrew-count';

interface VictoryPathProps {
  sessions: TrendSession[];
  targetScore?: number;
}

interface ChartPoint {
  date: string;
  actual: number;
}

function formatDateShort(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString('he-IL', { day: 'numeric', month: 'short' });
}

/** Axis ticks are SVG text, which is LTR by default and would print "7 ביולי"
 * as "ביולי 7"; render them right-to-left. */
function DateTick({ x, y, payload }: { x?: number; y?: number; payload?: { value: string } }) {
  return (
    <text x={x} y={(y ?? 0) + 12} textAnchor="middle" direction="rtl" fontSize={10} fill="currentColor">
      {payload ? formatDateShort(payload.value) : ''}
    </text>
  );
}

/** "כ-1.2 נק׳ ביום", or per week when the daily rate would round to 0.0. */
function formatRate(slopePerDay: number): string {
  if (slopePerDay >= 0.05) return `כ-${slopePerDay.toFixed(1)} נק׳ ביום`;
  return `כ-${Math.max(0.1, slopePerDay * 7).toFixed(1)} נק׳ בשבוע`;
}

/**
 * The student's actual exam scores over time against the 134 line, with
 * the trend so far (src/lib/trend.ts). No projected date: extrapolating a
 * few noisy scores into "N days to 134" claimed more than the data knew.
 * Below the trend guardrail (fewer than 4 exams or 3 distinct days) the
 * chart still shows the scores, and the text says a trend needs more data.
 */
export function VictoryPath({ sessions, targetScore = 134 }: VictoryPathProps) {
  const trend = useMemo(() => computeTrend(sessions), [sessions]);

  const heading = (
    <h2 className="font-bold text-exam-ink mb-1 flex items-center gap-2">
      <TrendingUp className="w-4 h-4" aria-hidden />
      מסלול הניצחון
    </h2>
  );

  const remaining = Math.max(0, MIN_SESSIONS - sessions.length);
  const needMore = remaining > 0
    ? `עוד ${heCount(remaining, 'exam')} ונוכל למדוד מגמה. היא מבוססת על הקצב שלך לאורך זמן, לא על ניחוש`
    : 'עוד קצת. כדי למדוד מגמה צריך מבחנים מכמה ימים שונים';

  if (sessions.length < 2) {
    return (
      <div className="bg-exam-surface rounded-2xl shadow-surface hover:shadow-raised transition-shadow duration-300 ease-spring border border-exam-border p-5 animate-fade-up">
        {heading}
        <p className="text-sm text-exam-ink-soft">{needMore}</p>
      </div>
    );
  }

  const sorted = [...sessions].sort((a, b) => a.completed_at.localeCompare(b.completed_at));
  const data: ChartPoint[] = sorted.map(s => ({ date: s.completed_at.slice(0, 10), actual: s.score }));

  const yMin = Math.min(50, ...sorted.map(s => s.score), targetScore) - 5;
  const yMax = Math.max(150, ...sorted.map(s => s.score), targetScore) + 5;

  return (
    <div className="bg-exam-surface rounded-2xl shadow-raised hover:shadow-overlay transition-shadow duration-300 ease-spring border border-exam-border p-5 animate-fade-up">
      {heading}
      <p className="text-xs text-exam-ink-soft mb-2">כל {sessions.length} המבחנים · הקצב נמדד לפי ימים, לא לפי מספר המבחנים</p>
      <p className="text-sm text-exam-ink-soft mb-4" data-metric="trend">
        {!trend ? (
          needMore
        ) : trend.currentScore >= targetScore ? (
          <>הגעת ליעד: <bdi dir="ltr" className="font-bold text-exam-sage-strong">{targetScore}+</bdi> במבחן האחרון. עכשיו שומרים על הכושר.</>
        ) : trend.slopePerDay < MIN_MEANINGFUL_SLOPE ? (
          <>המגמה עדיין לא עולה. תרגול ממוקד בנקודות החולשה הוא מה שיזיז אותה למעלה.</>
        ) : (
          <>הציון שלך עולה ב{formatRate(trend.slopePerDay)}.</>
        )}
      </p>
      <div className="h-56" dir="ltr">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="currentColor" className="text-exam-border" vertical={false} />
            <XAxis
              dataKey="date"
              tick={<DateTick />}
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
              width={36}
            />
            <Tooltip
              labelFormatter={label => formatDateShort(String(label))}
              formatter={value => [Math.round(Number(value)), 'ציון']}
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
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
