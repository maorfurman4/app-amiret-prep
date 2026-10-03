'use client';

import { useEffect } from 'react';
import { createClient } from '@/lib/supabase';
import { hasPendingGuestMerge, mergeGuestProgress } from '@/lib/merge-guest-client';

/**
 * Finishes a guest→account merge that failed for a transient reason at login
 * time (offline, server hiccup). Login never waits on that failure — it just
 * leaves a flag — and this picks it up on the next page load, silently.
 * Renders nothing; does nothing at all unless the flag is set.
 */
export function GuestMergeRetry() {
  useEffect(() => {
    if (!hasPendingGuestMerge()) return;
    let cancelled = false;
    createClient().auth.getSession().then(({ data: { session } }) => {
      if (!cancelled && session) void mergeGuestProgress(session.access_token, session.user.id);
    }).catch(() => {});
    return () => { cancelled = true; };
  }, []);
  return null;
}
