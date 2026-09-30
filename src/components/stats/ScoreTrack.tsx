import { EXEMPTION_SCORE } from '@/lib/calibration';

/** Position on the 50–150 track, as a % from the left: scales read low → high, left → right. */
export const trackPct = (score: number) => Math.min(100, Math.max(0, score - 50));

export interface TrackMarker {
  score: number;
  /** Fill class for the dot (a token bg-* class). */
  className: string;
}

/**
 * The one score scale the app draws: 50 → 150, left to right in every
 * direction (the wrapper is dir="ltr", so an RTL page can't mirror it),
 * with the likely range as a band, the 134 line and optional score dots.
 * Decorative — callers state the same numbers in text.
 */
export function ScoreTrack({ lo, hi, bandClass, markers = [] }: {
  lo: number;
  hi: number;
  bandClass: string;
  markers?: TrackMarker[];
}) {
  return (
    <div dir="ltr" aria-hidden>
      <div className="relative h-3 rounded-full bg-exam-paper-alt border border-exam-border">
        <div
          className={`absolute inset-y-0 rounded-full opacity-35 ${bandClass}`}
          style={{ left: `${trackPct(lo)}%`, width: `${Math.max(trackPct(hi) - trackPct(lo), 1.5)}%` }}
        />
        <div className="absolute -top-1.5 -bottom-1.5 w-0.5 rounded-full bg-exam-sage-strong" style={{ left: `calc(${trackPct(EXEMPTION_SCORE)}% - 1px)` }} />
        {markers.map((m, i) => (
          <div
            key={i}
            className={`absolute top-1/2 size-3.5 -translate-y-1/2 -translate-x-1/2 rounded-full border-2 border-exam-surface shadow-surface ${m.className}`}
            style={{ left: `${trackPct(m.score)}%` }}
          />
        ))}
      </div>
      <div className="relative mt-1.5 h-4 text-[11px] text-exam-ink-soft tabular-nums">
        <span className="absolute left-0">50</span>
        <span className="absolute font-semibold text-exam-sage-strong -translate-x-1/2" style={{ left: `${trackPct(EXEMPTION_SCORE)}%` }}>{EXEMPTION_SCORE}</span>
        <span className="absolute right-0">150</span>
      </div>
    </div>
  );
}
