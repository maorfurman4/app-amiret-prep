/**
 * Cached display ID only. Authorization uses the signed HttpOnly cookie.
 * Legacy localStorage UUIDs never establish ownership on the server.
 * Every visitor gets a stable ID so
 * guest-mode features (exam, practice, review queue, stats, streak...)
 * work fully logged-out. Auth accounts don't need this — the server
 * resolves `user_id` from the session instead.
 */
export function getOrCreateGuestId(): string {
  if (typeof window === 'undefined') return '';
  try { return localStorage.getItem('amiret_guest_id') ?? ''; }
  catch { return ''; }
}

let initialization: Promise<void> | null = null;

export function ensureGuestIdentity(): Promise<void> {
  if (!initialization) {
    initialization = fetch('/api/auth/guest', { method: 'POST', credentials: 'same-origin', cache: 'no-store' })
      .then(async response => {
        if (!response.ok) throw new Error('לא ניתן להתחיל כעת. נסה לרענן את הדף.');
        const { guestId } = await response.json() as { guestId: string };
        // Preserve the old identifier for manual recovery; never send it as proof.
        try {
          const old = localStorage.getItem('amiret_guest_id');
          if (old && old !== guestId && !localStorage.getItem('amiret_legacy_guest_id')) {
            localStorage.setItem('amiret_legacy_guest_id', old);
          }
          localStorage.setItem('amiret_guest_id', guestId);
        } catch { /* Storage may be disabled; the HttpOnly cookie is sufficient. */ }
      }).catch(error => { initialization = null; throw error; });
  }
  return initialization;
}

/**
 * Ends the current guest identity: clears the signed HttpOnly cookie
 * server-side (client JS can't drop it directly) and drops the cached
 * display id, so the next ensureGuestIdentity() call — whether right after
 * sign-out or on a future visit — mints a genuinely fresh identity instead
 * of reusing one that may already be attached to an account (via merge) or
 * to whoever used this browser/device before. Best-effort: sign-out itself
 * always proceeds even if this fails (e.g. offline).
 */
export function clearGuestIdentity(): Promise<void> {
  initialization = null;
  try {
    localStorage.removeItem('amiret_guest_id');
    localStorage.removeItem('amiret_legacy_guest_id');
  } catch { /* Storage may be disabled. */ }
  return fetch('/api/auth/guest', { method: 'DELETE', credentials: 'same-origin', cache: 'no-store' })
    .then(() => {})
    .catch(() => {});
}
