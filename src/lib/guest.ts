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
