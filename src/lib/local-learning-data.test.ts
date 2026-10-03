import { describe, expect, it } from 'vitest';
import {
  GUEST_OWNER, LOCAL_OWNER_KEY,
  clearLocalLearningData, localListsUsableBy, readLocalOwner, reconcileLocalOwner,
} from './local-learning-data';

function memoryStorage(entries: Record<string, string> = {}) {
  const map = new Map(Object.entries(entries));
  return {
    map,
    getItem: (k: string) => map.get(k) ?? null,
    setItem: (k: string, v: string) => { map.set(k, v); },
    removeItem: (k: string) => { map.delete(k); },
    key: (i: number) => [...map.keys()][i] ?? null,
    get length() { return map.size; },
  };
}

/** A device after a signed-in account used every feature. */
const usedDevice = () => memoryStorage({
  vocab_known_ids: '["k1"]',
  vocab_favorites: '["f1"]',
  vocab_known_schedule: '{"k1":{"interval_days":2,"next_review_at":"2026-10-05T00:00:00Z"}}',
  vocab_timed_history: '[{"date":"3.10.2026","score":8,"total":10,"pack":"כל המילים"}]',
  amiret_pending_guest_merge: '1',
  amiret_streak_celebration_seen_date: '2026-10-03',
  'exam_draft:s1:2': '[0,null,2,1]',
  'exam_draft:s1:3': '[1,1,1,1,1]',
  'amiret_score_prompt_snooze:2026-09-30': '2026-10-04',
  [LOCAL_OWNER_KEY]: 'user-A',
  // Not anyone's progress — must survive.
  theme: 'dark',
  amiret_pace_hint: 'off',
  vocab_cache_v5: '{"data":[],"ts":0}',
  amiret_guest_id: 'g-1',
});

describe('clearLocalLearningData', () => {
  it('removes every learning key, including per-session drafts and per-date snoozes', () => {
    const storage = usedDevice();
    clearLocalLearningData(storage);
    expect([...storage.map.keys()].sort()).toEqual(['amiret_guest_id', 'amiret_pace_hint', 'theme', 'vocab_cache_v5']);
  });

  it('keeps device preferences and the shared word-bank cache', () => {
    const storage = usedDevice();
    clearLocalLearningData(storage);
    expect(storage.getItem('theme')).toBe('dark');
    expect(storage.getItem('amiret_pace_hint')).toBe('off');
    expect(storage.getItem('vocab_cache_v5')).not.toBeNull();
  });

  it('is a no-op without storage, and survives storage that throws', () => {
    expect(() => clearLocalLearningData(null)).not.toThrow();
    const broken = { ...memoryStorage(), get length(): number { throw new Error('SecurityError'); } };
    expect(() => clearLocalLearningData(broken)).not.toThrow();
  });
});

describe('localListsUsableBy', () => {
  it('lets anyone take guest or unlabelled lists (the guest → account merge)', () => {
    expect(localListsUsableBy(null, 'user-B')).toBe(true);
    expect(localListsUsableBy(GUEST_OWNER, 'user-B')).toBe(true);
  });

  it('lets an account take its own copy, never another account\'s', () => {
    expect(localListsUsableBy('user-A', 'user-A')).toBe(true);
    expect(localListsUsableBy('user-A', 'user-B')).toBe(false);
  });
});

describe('reconcileLocalOwner', () => {
  it('signed out on a device holding an account\'s lists (expired session): wipes them, then labels the device guest', () => {
    const storage = usedDevice();
    expect(reconcileLocalOwner(null, storage)).toBe(true);
    expect(storage.getItem('vocab_known_ids')).toBeNull();
    expect(readLocalOwner(storage)).toBe(GUEST_OWNER);
  });

  it('a different account signs in: wipes the previous account\'s lists and labels them for the new one', () => {
    const storage = usedDevice();
    expect(reconcileLocalOwner('user-B', storage)).toBe(true);
    expect(storage.getItem('vocab_favorites')).toBeNull();
    expect(readLocalOwner(storage)).toBe('user-B');
  });

  it('the same account: keeps everything', () => {
    const storage = usedDevice();
    expect(reconcileLocalOwner('user-A', storage)).toBe(false);
    expect(storage.getItem('vocab_known_ids')).toBe('["k1"]');
  });

  it('a guest\'s lists are kept both while browsing and when that guest signs in', () => {
    const storage = memoryStorage({ vocab_known_ids: '["k1"]' }); // pre-owner leftovers
    expect(reconcileLocalOwner(null, storage)).toBe(false);
    expect(readLocalOwner(storage)).toBe(GUEST_OWNER);
    expect(reconcileLocalOwner('user-B', storage)).toBe(false);
    expect(storage.getItem('vocab_known_ids')).toBe('["k1"]');
    expect(readLocalOwner(storage)).toBe('user-B');
  });
});
