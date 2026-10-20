import { EXEMPTION_SCORE } from '@/lib/calibration';

/** Position on the 50–150 track, as a % from the left: scales read low → high, left → right. */
export const trackPct = (score: number) => Math.min(100, Math.max(0, score - 50));

/** The "+" of the 134+ mark: the logo's tassel cross, drawn with rounded arms. */
export const PLUS = 'M9 3a3 3 0 0 1 6 0v6h6a3 3 0 0 1 0 6h-6v6a3 3 0 0 1-6 0v-6H3a3 3 0 0 1 0-6h6z';

/**
 * The one score scale the app draws, on the navy score panel: 50 → 150,
 * left to right in every direction (dir="ltr", so the RTL page can't
 * mirror it). The fill runs to the latest score, the hatched stretch is
 * what's left to 134, the green line with the logo's "+" is 134, and the
 * amber mark is the best score. Decorative — the panel states the same
 * numbers in text. `fillRef` lets the panel animate the fill on load.
 *
 * Results only, both optional: `range` brackets the likely score range
 * under the track, and `knob` marks the score itself — green once it is
 * at or past 134. The knob follows --ride when the panel animates it.
 */
export function ScoreTrack({ score, best, fillRef, range, knob }: {
  score: number;
  best: number;
  fillRef?: React.Ref<HTMLDivElement>;
  range?: { lo: number; hi: number };
  knob?: boolean;
}) {
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
        <svg viewBox="0 0 24 24" className="score-plus absolute -top-[30px] size-4 -ml-2" style={{ left: `${gate}%` }}>
          <path d={PLUS} className="fill-stats-gate" />
        </svg>
        <div className="absolute -inset-y-2 w-[3px] -ml-[1.5px] rounded-full bg-stats-gate" style={{ left: `${gate}%` }} />
        {best !== score && (
          <div
            className="absolute top-[19px] -ml-[5px] size-0 border-x-[5px] border-x-transparent border-b-[7px] border-b-stats-best"
            style={{ left: `${trackPct(best)}%` }}
          />
        )}
        {knob && (
          <div
            data-passed={score >= EXEMPTION_SCORE ? '' : undefined}
            className="score-knob absolute top-1/2 size-[22px] -mt-[11px] -ml-[11px] rounded-full ring-4 ring-stats-hero"
            style={{ left: `var(--ride, ${at}%)` }}
          />
        )}
      </div>
      {range && range.lo !== range.hi && (
        <div className="relative h-2 mt-2">
          <div
            className="absolute top-[3px] h-0.5 rounded-full bg-stats-hero-soft before:absolute before:left-0 before:-top-[3px] before:h-2 before:w-0.5 before:rounded-full before:bg-inherit after:absolute after:right-0 after:-top-[3px] after:h-2 after:w-0.5 after:rounded-full after:bg-inherit"
            style={{ left: `${trackPct(range.lo)}%`, width: `${trackPct(range.hi) - trackPct(range.lo)}%` }}
          />
        </div>
      )}
      <div className={`relative ${range ? 'mt-1.5' : 'mt-2.5'} h-4 text-[11px] text-stats-hero-soft tabular-nums`}>
        <span className="absolute left-0">50</span>
        <span className="absolute left-1/2 -translate-x-1/2">100</span>
        <span className="absolute font-bold text-stats-gate -translate-x-1/2" style={{ left: `${gate}%` }}>{EXEMPTION_SCORE}</span>
        <span className="absolute right-0">150</span>
      </div>
    </div>
  );
}
