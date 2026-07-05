'use client';

import { Suspense, useEffect } from 'react';
import { createClient } from '@/lib/supabase';
import { useRouter, useSearchParams } from 'next/navigation';

function CallbackHandler() {
  const supabase = createClient();
  const router = useRouter();
  const searchParams = useSearchParams();

  useEffect(() => {
    const next = searchParams.get('next') ?? '/';
    const safeNext = next.startsWith('/') ? next : '/';

    // With flowType: 'implicit', Supabase puts the session in the URL hash.
    // detectSessionInUrl: true auto-processes it and fires SIGNED_IN.
    // Move any guest-mode history onto the account (fire-and-forget, idempotent)
    const mergeGuest = (accessToken: string) => {
      const guestId = localStorage.getItem('amiret_guest_id');
      if (!guestId) return;
      fetch('/api/auth/merge-guest', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${accessToken}` },
        body: JSON.stringify({ guestId }),
        keepalive: true,
      }).catch(() => {});
    };

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_IN' && session) {
        mergeGuest(session.access_token);
        router.replace(safeNext);
      }
    });

    // Fallback: if already signed in or no hash event fires
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) {
        mergeGuest(session.access_token);
        router.replace(safeNext);
      }
    });

    // Last resort timeout — only redirect if session exists, otherwise show error
    const timer = setTimeout(async () => {
      const { data: { session: fallbackSession } } = await supabase.auth.getSession();
      router.replace(fallbackSession ? safeNext : '/auth/login');
    }, 6000);

    return () => {
      subscription.unsubscribe();
      clearTimeout(timer);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-900 to-slate-800 flex items-center justify-center">
      <div className="text-white text-center space-y-4">
        <div className="w-10 h-10 border-2 border-white/30 border-t-white rounded-full animate-spin mx-auto" />
        <p className="text-slate-300">מתחבר...</p>
      </div>
    </div>
  );
}

export default function CallbackPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-gradient-to-b from-slate-900 to-slate-800 flex items-center justify-center">
        <div className="text-white">טוען...</div>
      </div>
    }>
      <CallbackHandler />
    </Suspense>
  );
}
