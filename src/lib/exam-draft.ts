type ReadableStorage = Pick<Storage, 'getItem'>;
type WritableStorage = Pick<Storage, 'setItem'>;
type ClearableStorage = Pick<Storage, 'removeItem'>;

export function examDraftKey(sessionId: string, section: number) {
  return `exam_draft:${sessionId}:${section}`;
}

export function readExamDraft(
  storage: ReadableStorage,
  sessionId: string,
  section: number,
  questionCount: number,
): (number | null)[] | null {
  try {
    const raw = storage.getItem(examDraftKey(sessionId, section));
    if (!raw) return null;

    const value = JSON.parse(raw) as unknown;
    if (!Array.isArray(value) || value.length !== questionCount) return null;
    if (!value.every(answer => answer === null
      || (Number.isInteger(answer) && answer >= 0 && answer <= 3))) return null;

    return value as (number | null)[];
  } catch {
    return null;
  }
}

export function writeExamDraft(
  storage: WritableStorage,
  sessionId: string,
  section: number,
  answers: (number | null)[],
) {
  try {
    storage.setItem(examDraftKey(sessionId, section), JSON.stringify(answers));
  } catch {
    // Draft persistence is best-effort when storage is unavailable or full.
  }
}

export function clearExamDraft(storage: ClearableStorage, sessionId: string, section: number) {
  try {
    storage.removeItem(examDraftKey(sessionId, section));
  } catch {
    // Ignore unavailable storage; the server remains the source of truth.
  }
}
