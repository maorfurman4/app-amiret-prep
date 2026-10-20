'use client';

import { useId, useMemo } from 'react';
import {
  Area, AreaChart, XAxis, YAxis, CartesianGrid, ReferenceArea, ReferenceLine, Tooltip, ResponsiveContainer,
} from 'recharts';
import { computeTrend, examDay, MIN_MEANINGFUL_SLOPE, MIN_SESSIONS, type TrendSession } from '@/lib/trend';
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
    <text x={x} y={(y ?? 0) + 14} textAnchor="middle" direction="rtl" fontSize={10} fill="currentColor">
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
 * how far they've come since the first exam and the trend so far
 * (src/lib/trend.ts). No projected date: extrapolating a few noisy scores
 * into "N days to 134" claimed more than the data knew. Below the trend
 * guardrail (fewer than 4 exams or 3 distinct days) the chart still shows
 * the scores, and the text says a trend needs more data. Drawn straight on
 * the page, without a card: the navy panel above is the page's one raised
 * surface.
 */
export function VictoryPath({ sessions, targetScore = 134 }: VictoryPathProps) {
  const trend = useMemo(() => computeTrend(sessions), [sessions]);
  const headingId = useId();
  const gradientId = `stats-area-${useId().replace(/\W/g, '')}`;

  const heading = <h2 id={headingId} className="text-lg font-bold text-exam-ink">הציון לאורך זמן</h2>;

  const remaining = Math.max(0, MIN_SESSIONS - sessions.length);
  const needMore = remaining > 0
    ? `עוד ${heCount(remaining, 'exam')} ונוכל למדוד מגמה. היא מבוססת על הקצב שלך לאורך זמן, לא על ניחוש`
    : 'עוד קצת. כדי למדוד מגמה צריך מבחנים מכמה ימים שונים';

  if (sessions.length < 2) {
    return (
      <section aria-labelledby={headingId} className="space-y-1.5">
        {heading}
        <p className="text-sm text-exam-ink-soft">{needMore}</p>
      </section>
    );
  }

  const sorted = [...sessions].sort((a, b) => a.completed_at.localeCompare(b.completed_at));
  const data: ChartPoint[] = sorted.map(s => ({ date: examDay(s.completed_at), actual: s.score }));
  const scores = sorted.map(s => s.score);
  const sinceFirst = scores[scores.length - 1] - scores[0];
  const bestIndex = scores.indexOf(Math.max(...scores));

  const yMin = Math.max(50, Math.floor((Math.min(...scores) - 8) / 10) * 10);
  const yMax = Math.max(...scores, targetScore) + 10;
  const ticks = Array.from({ length: Math.floor(yMax / 20) - Math.ceil(yMin / 20) + 1 }, (_, i) => (Math.ceil(yMin / 20) + i) * 20);

  /** Every exam a small dot; the best in amber, the latest larger and labelled. */
  const renderDot = ({ cx, cy, index }: { cx?: number; cy?: number; index: number }) => {
    if (cx === undefined || cy === undefined) return <g key={index} />;
    const last = index === data.length - 1;
    return (
      <g key={index}>
        <circle
          cx={cx} cy={cy} r={last ? 5.5 : 3}
          className={index === bestIndex && !last ? 'fill-exam-alt' : 'fill-current'}
          stroke={last ? 'var(--exam-paper)' : 'none'} strokeWidth={2}
        />
        {last && (
          <text x={cx - 9} y={cy - 10} textAnchor="end" fontSize={13} fontWeight={800} className="fill-exam-ink">
            {data[index].actual}
          </text>
        )}
      </g>
    );
  };

  return (
    <section aria-labelledby={headingId} className="space-y-2.5">
      {heading}
      <p className="flex flex-wrap items-center gap-x-3 gap-y-2 text-sm text-exam-ink-soft" data-metric="trend">
        {sinceFirst !== 0 && (
          <span className={`inline-flex px-2.5 py-0.5 rounded-full text-sm font-bold ${sinceFirst > 0 ? 'bg-exam-sage-bg text-exam-sage' : 'bg-exam-paper-alt text-exam-ink'}`}>
            <bdi dir="ltr" className="tabular-nums">{sinceFirst > 0 ? `+${sinceFirst}` : `−${-sinceFirst}`}</bdi>&nbsp;מאז המבחן הראשון
          </span>
        )}
        <span>
          {!trend ? (
            needMore
          ) : trend.currentScore >= targetScore ? (
            <>הגעת ליעד: <bdi dir="ltr" className="font-bold text-exam-sage-strong">{targetScore}+</bdi> במבחן האחרון. עכשיו שומרים על הכושר.</>
          ) : trend.slopePerDay < MIN_MEANINGFUL_SLOPE ? (
            <>המגמה עדיין לא עולה. תרגול ממוקד בנקודות החולשה הוא מה שיזיז אותה למעלה.</>
          ) : (
            <>הציון שלך עולה ב{formatRate(trend.slopePerDay)}.</>
          )}
        </span>
      </p>
      <div className="h-56 text-stats-line" dir="ltr">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data} margin={{ top: 22, right: 16, left: 0, bottom: 0 }}>
            <defs>
              <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0" style={{ stopColor: 'var(--stats-area)' }} />
                <stop offset="1" style={{ stopColor: 'var(--stats-area)', stopOpacity: 0 }} />
              </linearGradient>
            </defs>
            <ReferenceArea y1={targetScore} y2={yMax} fill="currentColor" fillOpacity={1} className="text-[var(--stats-zone)]" ifOverflow="hidden" />
            <CartesianGrid stroke="currentColor" className="text-exam-border" vertical={false} />
            <XAxis
              dataKey="date"
              tick={<DateTick />}
              className="text-exam-ink-soft"
              axisLine={false}
              tickLine={false}
              minTickGap={24}
            />
            <YAxis
              domain={[yMin, yMax]}
              ticks={ticks}
              tick={{ fontSize: 10, fill: 'currentColor' }}
              className="text-exam-ink-soft"
              axisLine={false}
              tickLine={false}
              width={32}
            />
            <Tooltip
              labelFormatter={label => formatDateShort(String(label))}
              formatter={value => [Math.round(Number(value)), 'ציון']}
              contentStyle={{ fontSize: 12, direction: 'rtl', background: 'var(--exam-surface)', border: '1px solid var(--exam-border)', borderRadius: 10, color: 'var(--exam-ink)' }}
            />
            <ReferenceLine
              y={targetScore}
              stroke="currentColor"
              className="text-exam-sage"
              strokeWidth={1.5}
              strokeDasharray="4 4"
              strokeLinecap="round"
              label={{ value: String(targetScore), position: 'insideTopLeft', fontSize: 11, fontWeight: 700, fill: 'currentColor' }}
            />
            <Area
              type="monotone"
              dataKey="actual"
              stroke="currentColor"
              strokeWidth={2.5}
              strokeLinecap="round"
              strokeLinejoin="round"
              fill={`url(#${gradientId})`}
              dot={renderDot}
              activeDot={{ r: 5, strokeWidth: 2, stroke: 'var(--exam-paper)', fill: 'currentColor' }}
              isAnimationActive={false}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
      <p className="text-xs text-exam-ink-soft">כל {sessions.length} המבחנים. הקצב נמדד לפי ימים, לא לפי מספר המבחנים.</p>
    </section>
  );
}
