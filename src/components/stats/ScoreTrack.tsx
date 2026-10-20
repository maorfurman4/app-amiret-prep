import { EXEMPTION_SCORE } from '@/lib/calibration';

/** Position on the 50–150 track, as a % from the left: scales read low → high, left → right. */
export const trackPct = (score: number) => Math.min(100, Math.max(0, score - 50));

/** The "+" of the 134+ mark: the logo's tassel cross, drawn with rounded arms. */
const PLUS = 'M9 3a3 3 0 0 1 6 0v6h6a3 3 0 0 1 0 6h-6v6a3 3 0 0 1-6 0v-6H3a3 3 0 0 1 0-6h6z';

/**
 * The one score scale the app draws, on the navy score panel: 50 → 150,
 * left to right in every direction (dir="ltr", so the RTL page can't
 * mirror it). The fill runs to the latest score, the hatched stretch is
 * what's left to 134, the green line with the logo's "+" is 134, and the
 * amber mark is the best score. Decorative — the panel states the same
 * numbers in text. `fillRef` lets the panel animate the fill on load.
 */
export function ScoreTrack({ score, best, fillRef }: { score: number; best: number; fillRef?: React.Ref<HTMLDivElement> }) {
  const gate = trackPct(EXEMPTION_SCORE);
  const at = trackPct(score);
  return (
    <div dir="ltr" aria-hidden className="mt-10">
      <div className="relative h-3.5 rounded-full bg-white/[0.08]">
        <div ref={fillRef} className="absolute inset-y-0 left-0 rounded-full bg-stats-fill" style={{ width: `${at}%` }} />
        {at < gate && (
          <div
            className="stats-togo absolute inset-y-0"
            style={{ left: `${at}%`, width: `${gate - at}%`, backgroundImage: 'repeating-linear-gradient(-45deg, rgb(183 201 241 / 0.38) 0 2px, transparent 2px 6px)' }}
          />
        )}
        <svg viewBox="0 0 24 24" className="absolute -top-[30px] size-4 -ml-2" style={{ left: `${gate}%` }}>
          <path d={PLUS} className="fill-stats-gate" />
        </svg>
        <div className="absolute -inset-y-2 w-[3px] -ml-[1.5px] rounded-full bg-stats-gate" style={{ left: `${gate}%` }} />
        {best !== score && (
          <div
            className="absolute top-[19px] -ml-[5px] size-0 border-x-[5px] border-x-transparent border-b-[7px] border-b-stats-best"
            style={{ left: `${trackPct(best)}%` }}
          />
        )}
      </div>
      <div className="relative mt-2.5 h-4 text-[11px] text-stats-hero-soft tabular-nums">
        <span className="absolute left-0">50</span>
        <span className="absolute left-1/2 -translate-x-1/2">100</span>
        <span className="absolute font-bold text-stats-gate -translate-x-1/2" style={{ left: `${gate}%` }}>{EXEMPTION_SCORE}</span>
        <span className="absolute right-0">150</span>
      </div>
    </div>
  );
}
