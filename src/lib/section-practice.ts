/**
 * What a blank answer in a timed practice section means. "Time ran out"
 * only when the timer actually ended the section — a section finished
 * early with "סיים מקבץ" left its blanks unanswered by choice.
 */
export function blankLabel(endedByTimer: boolean): string {
  return endedByTimer ? 'לא ענית, הזמן נגמר' : 'לא ענית';
}
