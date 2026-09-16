import { describe, expect, it } from 'vitest';
import { clearExamDraft, examDraftKey, readExamDraft, writeExamDraft } from './exam-draft';

function createStorage() {
  const values = new Map<string, string>();
  return {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => { values.set(key, value); },
    removeItem: (key: string) => { values.delete(key); },
  };
}

describe('exam draft persistence', () => {
  it('restores answers only for the matching session and section', () => {
    const storage = createStorage();
    writeExamDraft(storage, 'session-a', 2, [1, null, 3]);

    expect(readExamDraft(storage, 'session-a', 2, 3)).toEqual([1, null, 3]);
    expect(readExamDraft(storage, 'session-a', 3, 3)).toBeNull();
    expect(readExamDraft(storage, 'session-b', 2, 3)).toBeNull();
  });

  it('rejects stale, malformed, and out-of-range drafts', () => {
    const storage = createStorage();
    storage.setItem(examDraftKey('session', 1), JSON.stringify([1, 2]));
    expect(readExamDraft(storage, 'session', 1, 3)).toBeNull();

    storage.setItem(examDraftKey('session', 1), JSON.stringify([1, 4, null]));
    expect(readExamDraft(storage, 'session', 1, 3)).toBeNull();

    storage.setItem(examDraftKey('session', 1), '{invalid json');
    expect(readExamDraft(storage, 'session', 1, 3)).toBeNull();
  });

  it('clears only the submitted section', () => {
    const storage = createStorage();
    writeExamDraft(storage, 'session', 1, [0]);
    writeExamDraft(storage, 'session', 2, [1]);

    clearExamDraft(storage, 'session', 1);

    expect(readExamDraft(storage, 'session', 1, 1)).toBeNull();
    expect(readExamDraft(storage, 'session', 2, 1)).toEqual([1]);
  });
});
