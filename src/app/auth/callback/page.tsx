'use client';

import { Suspense, useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase';
import { useRouter, useSearchParams } from 'next/navigation';
import { recoveryLinkIsInvalid } from '@/lib/password-recovery';
import { safeRedirectPath } from '@/lib/safe-redirect';
import { mergeGuestProgress } from '@/lib/merge-guest-client';
import { RotateCcw, AlertCircle } from 'lucide-react';

function CallbackHandler() {
  const router = useRouter();
  const searchParams = useSearchParams();

  // Read the hash synchronously: supabase-js strips it once it has processed
  // the tokens, so by the time an effect runs it may already be gone.
  const [initialHash] = useState(() => (typeof window !== 'undefined' ? window.location.hash : ''));
  const supabase = createClient();
  // Set only if the post-login guest-data merge fails after its retries —
  // holds what's needed to retry just the merge without re-running OAuth.
  const [mergeFailed, setMergeFailed] = useState<{ token: string; destination: string } | null>(null);

  useEffect(() => {
    const safeNext = safeRedirectPath(searchParams.get('next'));
    const isRecovery = new URLSearchParams(initialHash.replace(/^#/, '')).get('type') === 'recovery';
    let navigated = false;
    let cancelled = false;
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
    // Move any guest-mode history onto the account before continuing —
    // awaited and retried, because a silently-lost merge here means real
    // study progress (a streak, known/favorited vocab words) never makes it
    // onto the account. Only blocks navigation if it still fails after
    // retrying, so the user can choose to continue without it.
    const finishAuth = async (accessToken: string, destination: string) => {
      const result = await mergeGuestProgress(accessToken);
      if (cancelled) return;
      if (!result.ok) {
        // Stop the 6s fallback from yanking the user past this — they
        // should get to choose retry vs. continue, not have it decided for
        // them by a timer that has nothing to do with the merge itself.
        clearTimeout(timer);
        setMergeFailed({ token: accessToken, destination });
        return;
      }
      navigate(destination);
    };

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      // A password-recovery link must end on the reset screen no matter what
      // `next` says, otherwise the user never gets to set a new password.
      if (event === 'PASSWORD_RECOVERY' && session) {
        navigate('/auth/reset-password');
        return;
      }
      if (event === 'SIGNED_IN' && session) {
        void finishAuth(session.access_token, isRecovery ? '/auth/reset-password' : safeNext);
      }
    });

    // Fallback: if already signed in or no hash event fires
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) {
        void finishAuth(session.access_token, isRecovery ? '/auth/reset-password' : safeNext);
      }
    });

    // Last resort timeout — only redirect if session exists, otherwise show error
    const timer = setTimeout(async () => {
      const { data: { session: fallbackSession } } = await supabase.auth.getSession();
      navigate(fallbackSession ? (isRecovery ? '/auth/reset-password' : safeNext) : '/auth/login');
    }, 6000);

    return () => {
      navigated = true;
      cancelled = true;
      subscription.unsubscribe();
      clearTimeout(timer);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const retryMerge = async () => {
    if (!mergeFailed) return;
    const { token, destination } = mergeFailed;
    const result = await mergeGuestProgress(token);
    if (result.ok) {
      setMergeFailed(null);
      router.replace(destination);
    } else {
      setMergeFailed({ token, destination });
    }
  };

  if (mergeFailed) {
    return (
      <div className="min-h-dvh bg-exam-paper flex items-center justify-center px-4" dir="rtl">
        <div className="text-center space-y-4 max-w-sm">
          <AlertCircle className="w-12 h-12 mx-auto text-exam-alt" strokeWidth={1.5} aria-hidden />
          <h2 className="text-xl font-bold text-exam-ink">ההתחברות הצליחה</h2>
          <p className="text-exam-ink-soft text-sm leading-relaxed">
            אבל לא הצלחנו לאשר שההתקדמות שצברת כאורח/ת (רצף ימים, מילים שסימנת) הועברה לחשבון.
            הנתונים עדיין נשמרים במכשיר הזה — כדאי לנסות שוב.
          </p>
          <button
            onClick={retryMerge}
            className="w-full py-3 bg-exam-accent text-exam-accent-ink rounded-sm font-bold hover:opacity-90 transition-opacity flex items-center justify-center gap-2"
          >
            <RotateCcw className="w-4 h-4" aria-hidden />נסה שוב
          </button>
          <button
            onClick={() => router.replace(mergeFailed.destination)}
            className="w-full py-2.5 border border-exam-border text-exam-ink-soft rounded-sm text-sm hover:bg-exam-paper-alt transition-colors"
          >
            המשך בלי לשמור כרגע
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-dvh bg-exam-paper flex items-center justify-center">
      <div className="text-exam-ink text-center space-y-4">
        <div className="w-10 h-10 border-2 border-exam-border border-t-exam-accent rounded-full animate-spin mx-auto" />
        <p className="text-exam-ink-soft">מתחבר...</p>
      </div>
    </div>
  );
}

export default function CallbackPage() {
  return (
    <Suspense fallback={
      <div className="min-h-dvh bg-exam-paper flex items-center justify-center">
        <div className="text-exam-ink">טוען...</div>
      </div>
    }>
      <CallbackHandler />
    </Suspense>
  );
}
