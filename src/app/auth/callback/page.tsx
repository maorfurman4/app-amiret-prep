'use client';

import { Suspense, useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase';
import { useRouter, useSearchParams } from 'next/navigation';
import { recoveryLinkIsInvalid } from '@/lib/password-recovery';
import { safeRedirectPath } from '@/lib/safe-redirect';

function CallbackHandler() {
  const router = useRouter();
  const searchParams = useSearchParams();

  // Read the hash synchronously: supabase-js strips it once it has processed
  // the tokens, so by the time an effect runs it may already be gone.
  const [initialHash] = useState(() => (typeof window !== 'undefined' ? window.location.hash : ''));
  const supabase = createClient();

  useEffect(() => {
    const safeNext = safeRedirectPath(searchParams.get('next'));
    const isRecovery = new URLSearchParams(initialHash.replace(/^#/, '')).get('type') === 'recovery';
    let navigated = false;
    const navigate = (destination: string) => {
      if (navigated) return;
      navigated = true;
      router.replace(destination);
    };

    // Supabase redirects here with `#error=...&error_code=otp_expired` when a
    // magic/recovery link is reused or expired. There is no session to wait
    // for, so send the user somewhere that explains it instead of spinning
    // for 6s and dumping them on the login form.
    if (recoveryLinkIsInvalid(initialHash)) {
      navigate('/auth/reset-password?error=invalid_link');
      return;
    }

    // With flowType: 'implicit', Supabase puts the session in the URL hash.
    // detectSessionInUrl: true auto-processes it and fires SIGNED_IN.
    // Move any guest-mode history onto the account (fire-and-forget, idempotent)
    const mergeGuest = (accessToken: string) => {
      fetch('/api/auth/merge-guest', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${accessToken}` },
        body: JSON.stringify({}),
        keepalive: true,
      }).catch(() => {});
    };

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      // A password-recovery link must end on the reset screen no matter what
      // `next` says, otherwise the user never gets to set a new password.
      if (event === 'PASSWORD_RECOVERY' && session) {
        navigate('/auth/reset-password');
        return;
      }
      if (event === 'SIGNED_IN' && session) {
        mergeGuest(session.access_token);
        navigate(isRecovery ? '/auth/reset-password' : safeNext);
      }
    });

    // Fallback: if already signed in or no hash event fires
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) {
        mergeGuest(session.access_token);
        navigate(isRecovery ? '/auth/reset-password' : safeNext);
      }
    });

    // Last resort timeout — only redirect if session exists, otherwise show error
    const timer = setTimeout(async () => {
      const { data: { session: fallbackSession } } = await supabase.auth.getSession();
      navigate(fallbackSession ? (isRecovery ? '/auth/reset-password' : safeNext) : '/auth/login');
    }, 6000);

    return () => {
      navigated = true;
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
