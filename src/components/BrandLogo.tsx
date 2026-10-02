/**
 * The 134+ mark without its app-icon tile, for use on the page itself.
 * Same geometry as public/logo.svg, but colored from theme tokens so it reads
 * on both the light paper and the dark background: numerals and cap in ink,
 * cap underside in soft ink, tassel cord and "+" in gold (a deeper gold on
 * light paper, where the brand #F1C779 would be too faint).
 */
export function BrandLogo({ className }: { className?: string }) {
  return (
    <svg viewBox="82 92 418 346" role="img" aria-label="134+" className={className}>
      <g
        transform="translate(30 96) scale(.84)"
        fill="none"
        strokeWidth={44}
        strokeLinecap="round"
        strokeLinejoin="round"
        className="stroke-exam-ink"
      >
        <path d="M90 214 L128 176 V376" />
        <path d="M180 208 A48 48 0 1 1 225 272 A52 52 0 1 1 176 342 M206 272 H225" />
        <path d="M392 376 V176 L300 316 H418" />
      </g>
      <g transform="rotate(-12 352 170)">
        <path d="M290.6 186.5 V229 Q352 257.3 413.4 229 V186.5" className="fill-exam-ink-soft" />
        <path d="M352 122.8 L470 170 L352 217.2 L234 170 Z" className="fill-exam-ink" />
      </g>
      <g fill="none" strokeLinecap="round" strokeLinejoin="round" className="stroke-[#D9A13B] dark:stroke-exam-alt">
        <path d="M352 170 L442 151 V250" strokeWidth={15} />
        <path d="M442 250 V318 M408 284 H476" strokeWidth={34} />
      </g>
    </svg>
  );
}
