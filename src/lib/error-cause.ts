/** Why a wrong answer went wrong, as the student reports it (responses.error_cause). */
export const ERROR_CAUSES = ['vocab', 'logic', 'time', 'careless'] as const;
export type ErrorCause = (typeof ERROR_CAUSES)[number];

export const ERROR_CAUSE_LABEL: Record<ErrorCause, string> = {
  vocab: 'לא הכרתי מילה',
  logic: 'טעיתי בהיגיון',
  time: 'לחץ זמן',
  careless: 'ידעתי, פספסתי',
};

/** Where a tag is written: a browser-logged row, or an exam row. */
export type TagTarget =
  | { clientRef: string }
  | { sessionId: string; itemId: string };
