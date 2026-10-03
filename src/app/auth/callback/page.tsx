'use client';

import { Suspense, useEffect, useState } from 'react';
import dynamic from 'next/dynamic';
import { createClient } from '@/lib/supabase';
import { useRouter, useSearchParams } from 'next/navigation';
import { CheckCircle2, LinkIcon, LogIn } from 'lucide-react';
import { recoveryLinkIsInvalid } from '@/lib/password-recovery';
import { safeRedirectPath } from '@/lib/safe-redirect';
import { parseAuthFlow } from '@/lib/auth-redirect';
import { mergeGuestProgress } from '@/lib/merge-guest-client';
import { AuthShell, PrimaryButton, Spinner, StatusView } from '@/components/auth/AuthUI';

type Phase = 'working' | 'confirmed' | 'link-error' | 'no-session';

// Long enough to read "your account is confirmed", short enough not to stall.
const CONFIRMED_PAUSE_MS = 1200;

function CallbackHandlerImpl() {
  const router = useRouter();
  const searchParams = useSearchParams();

  // Read the hash synchronously: supabase-js strips it once it has processed
  // the tokens, so by the time an effect runs it may already be gone.
  const [initialHash] = useState(() => (typeof window !== 'undefined' ? window.location.hash : ''));
  const supabase = createClient();
  const flow = parseAuthFlow(searchParams.get('flow'));
  const safeNext = safeRedirectPath(searchParams.get('next'));
  const hashParams = new URLSearchParams(initialHash.replace(/^#/, ''));
  const isRecovery = hashParams.get('type') === 'recovery' || flow === 'recovery' || safeNext === '/auth/reset-password';
  const isSignupConfirm = hashParams.get('type') === 'signup' || flow === 'signup';
  // Supabase comes back with `#error=...` (or `?error=` for OAuth) when an
  // email link is expired/reused or the user backed out of Google. There's
  // no session to wait for — explain it right away instead of spinning.
  const linkFailed = recoveryLinkIsInvalid(initialHash) || searchParams.has('error');
  const [phase, setPhase] = useState<Phase>(linkFailed && !isRecovery ? 'link-error' : 'working');

  useEffect(() => {
    let navigated = false;
    let cancelled = false;
    const navigate = (destination: string) => {
      if (navigated) return;
      navigated = true;
      router.replace(destination);
    };

    if (linkFailed) {
      // A dead recovery link gets the reset page's own explanation; any
      // other dead link is already showing the link-error state.
      if (isRecovery) navigate('/auth/reset-password?error=invalid_link');
      return;
    }

    // Nothing arrived at all — say so instead of silently dropping the user
    // on the login form. (finishAuth is only called after this line runs.)
    const timer = setTimeout(async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (cancelled) return;
      if (session) void finishAuth(session.access_token, session.user.id);
      else setPhase('no-session');
    }, 8000);

    // With flowType: 'implicit', Supabase puts the session in the URL hash.
    // detectSessionInUrl: true auto-processes it and fires SIGNED_IN.
    let finishing = false;
    const finishAuth = async (accessToken: string, userId: string) => {
      if (finishing) return;
      finishing = true;
      clearTimeout(timer);
      if (isRecovery) { navigate('/auth/reset-password'); return; }
      const started = Date.now();
      if (isSignupConfirm) setPhase('confirmed');
      // Never blocks the signed-in user: a missing guest identity is a normal
      // "nothing to merge", and a transient failure is retried quietly later.
      await mergeGuestProgress(accessToken, userId);
      if (cancelled) return;
      const wait = isSignupConfirm ? Math.max(0, CONFIRMED_PAUSE_MS - (Date.now() - started)) : 0;
      setTimeout(() => { if (!cancelled) navigate(safeNext); }, wait);
    };

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      // A password-recovery link must end on the reset screen no matter what
      // `next` says, otherwise the user never gets to set a new password.
      if (event === 'PASSWORD_RECOVERY' && session) {
        clearTimeout(timer);
        navigate('/auth/reset-password');
        return;
      }
      if (event === 'SIGNED_IN' && session) void finishAuth(session.access_token, session.user.id);
    });

    // Fallback: already signed in, or the hash was processed before we subscribed.
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) void finishAuth(session.access_token, session.user.id);
    });


    return () => {
      navigated = true;
      cancelled = true;
      subscription.unsubscribe();
      clearTimeout(timer);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (phase === 'confirmed') {
    return (
      <StatusView icon={CheckCircle2} tone="success" title="החשבון אושר!">
        <p className="flex items-center justify-center gap-2" role="status">
          <Spinner className="w-4 h-4 text-exam-sage" />מכינים לך את הכל…
        </p>
      </StatusView>
    );
  }

  if (phase === 'link-error') {
    const oauth = flow === 'oauth';
    return (
      <StatusView
        icon={oauth ? LogIn : LinkIcon}
        tone="warning"
        title={oauth ? 'הכניסה לא הושלמה' : 'הקישור כבר לא בתוקף'}
        actions={<PrimaryButton onClick={() => router.replace('/auth/login')}>חזרה למסך הכניסה</PrimaryButton>}
      >
        {oauth ? (
          <p>נראה שהחלון של Google נסגר לפני הסוף. אפשר פשוט לנסות שוב.</p>
        ) : (
          <>
            <p>קישור האישור פג תוקף או שכבר נעשה בו שימוש.</p>
            <p className="text-sm">כבר לחצת עליו פעם? אז החשבון מאושר — פשוט נכנסים. אם לא, בכניסה עם האימייל והסיסמה נציע לשלוח קישור חדש.</p>
          </>
        )}
      </StatusView>
    );
  }

  if (phase === 'no-session') {
    return (
      <StatusView
        icon={LogIn}
        tone="warning"
        title="לא הצלחנו להשלים את הכניסה"
        actions={<PrimaryButton onClick={() => router.replace('/auth/login')}>חזרה למסך הכניסה</PrimaryButton>}
      >
        <p>משהו בדרך לא הסתדר. כדאי לנסות שוב — זה בדרך כלל עובד בפעם השנייה.</p>
      </StatusView>
    );
  }

  return <Working />;
}

// The whole screen is decided by the URL hash (tokens or an error), which
// only exists in the browser — rendering it on the server would always
// produce the spinner and then mismatch on hydration.
const Working = () => (
  <div className="py-8 flex flex-col items-center gap-3" role="status">
    <Spinner className="w-9 h-9 text-exam-accent" />
    <p className="text-exam-ink font-semibold">מחברים אותך…</p>
    <p className="text-xs text-exam-ink-soft">זה לוקח רק רגע</p>
  </div>
);
const CallbackHandler = dynamic(() => Promise.resolve(CallbackHandlerImpl), { ssr: false, loading: Working });

export default function CallbackPage() {
  return (
    <AuthShell srTitle="134+: מתחברים">
      <Suspense fallback={<Working />}>
        <CallbackHandler />
      </Suspense>
    </AuthShell>
  );
}
