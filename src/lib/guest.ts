/**
 * Guest identity: every visitor gets a stable localStorage UUID so
 * guest-mode features (exam, practice, review queue, stats, streak...)
 * work fully logged-out. Auth accounts don't need this — the server
 * resolves `user_id` from the session instead.
 */
export function getOrCreateGuestId(): string {
  if (typeof window === 'undefined') return '';
  let id = localStorage.getItem('amiret_guest_id');
  if (!id) {
    id = crypto.randomUUID();
    localStorage.setItem('amiret_guest_id', id);
  }
  return id;
}
