/**
 * The home page's resting cards — the middle of the three depths /stats set
 * (raised: the exam CTA and "Today"; resting: these; recessed: none here).
 * One definition instead of a copy per card.
 */
export const CARD = 'bg-exam-surface border border-exam-border rounded-[20px] shadow-surface';
/** CARD as a tappable link: a lighter lift on hover (mouse only), a press on tap. */
export const CARD_LINK = `${CARD} hover:bg-exam-paper-alt hover:shadow-raised active:shadow-pressed active:scale-[0.98] transition-[background-color,box-shadow,transform] duration-300 ease-spring will-change-transform`;
/** The rounded square every home card's icon sits in. */
export const ICON_TILE = 'grid place-items-center shrink-0 rounded-xl bg-exam-paper-alt text-exam-accent';
/** The 2x2 entry tiles. */
export const SQUARE_LINK = `relative flex flex-col items-center gap-1 pt-[18px] pb-4 px-2 min-h-[122px] text-center ${CARD_LINK}`;
