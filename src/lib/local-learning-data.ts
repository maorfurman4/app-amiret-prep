/**
 * The learning progress this browser keeps on its own (vocabulary lists,
 * timed-quiz history, unfinished exam drafts…), and who it belongs to.
 *
 * The vocabulary lists are sent to /api/auth/merge-guest at sign-in and
 * added to whichever account signs in. On a shared device that used to hand
 * one person's lists to the next: the copy a signed-in account leaves here
 * survived sign-out and looked like guest progress. Two guards:
 *  - sign-out wipes this data (clearLocalLearningData);
 *  - the lists carry an owner — "guest" or the account's user id — so a
 *    session that ended without the sign-out button (expired, or signed out
 *    in another tab) still can't pass them to a different account.
 * Lists from before the owner existed have none and count as guest
 * progress, so a guest's existing work still merges on their first sign-in.
 *
 * Device preferences (theme, pace gauge) and the shared word-bank cache are
 * not anyone's progress and are left alone.
 */

/** "guest", or the user id of the account the lists belong to. */
export const LOCAL_OWNER_KEY = 'amiret_local_owner';
export const GUEST_OWNER = 'guest';

/** Exact keys holding one person's learning data. */
export const LEARNING_KEYS = [
  'vocab_known_ids',
  'vocab_favorites',
  'vocab_known_schedule',
  'vocab_timed_history',
  // A pending merge would otherwise run for whoever signs in next.
  'amiret_pending_guest_merge',
  'amiret_streak_celebration_seen_date',
  LOCAL_OWNER_KEY,
] as const;

/** Key prefixes holding one person's data (one key per session / date). */
export const LEARNING_KEY_PREFIXES = ['exam_draft:', 'amiret_score_prompt_snooze:'] as const;

type KeyedStorage = Pick<Storage, 'getItem' | 'setItem' | 'removeItem' | 'key' | 'length'>;

function defaultStorage(): KeyedStorage | null {
  try { return typeof localStorage === 'undefined' ? null : localStorage; } catch { return null; }
}

/** Removes every key listed above. Best-effort: storage may be disabled. */
export function clearLocalLearningData(storage: KeyedStorage | null = defaultStorage()): void {
  if (!storage) return;
  try {
    const prefixed: string[] = [];
    for (let i = 0; i < storage.length; i++) {
      const key = storage.key(i);
      if (key && LEARNING_KEY_PREFIXES.some(p => key.startsWith(p))) prefixed.push(key);
    }
    for (const key of [...LEARNING_KEYS, ...prefixed]) storage.removeItem(key);
  } catch { /* Storage disabled. */ }
}

export function readLocalOwner(storage: KeyedStorage | null = defaultStorage()): string | null {
  try { return storage?.getItem(LOCAL_OWNER_KEY) ?? null; } catch { return null; }
}

export function setLocalOwner(owner: string, storage: KeyedStorage | null = defaultStorage()): void {
  try { storage?.setItem(LOCAL_OWNER_KEY, owner); } catch { /* Storage disabled. */ }
}

/** True when the local lists belong to an account (not a guest, not unlabelled). */
export function ownedByAccount(owner: string | null): boolean {
  return owner !== null && owner !== GUEST_OWNER;
}

/**
 * May `userId` take the local lists? Yes for guest or unlabelled (pre-owner)
 * lists — that's the guest→account merge — and for the account's own copy.
 * No for another account's.
 */
export function localListsUsableBy(owner: string | null, userId: string): boolean {
  return !ownedByAccount(owner) || owner === userId;
}

/**
 * Who is using this browser right now (null = signed out). Another account's
 * leftovers are wiped; the lists are then labelled as the current user's
 * (or as guest progress). Returns whether anything was wiped, so a page
 * holding the lists in memory can drop its copy too.
 */
export function reconcileLocalOwner(currentUserId: string | null, storage: KeyedStorage | null = defaultStorage()): boolean {
  const owner = readLocalOwner(storage);
  const stale = currentUserId === null ? ownedByAccount(owner) : !localListsUsableBy(owner, currentUserId);
  if (stale) clearLocalLearningData(storage);
  setLocalOwner(currentUserId ?? GUEST_OWNER, storage);
  return stale;
}

/**
 * Sign-in: the lists become `userId`'s. Another account's copy is wiped
 * first (so it's never sent to the merge); guest or unlabelled lists are
 * kept — that is the guest's own progress being carried into the account.
 */
export function claimLocalListsFor(userId: string, storage: KeyedStorage | null = defaultStorage()): void {
  reconcileLocalOwner(userId, storage);
}
