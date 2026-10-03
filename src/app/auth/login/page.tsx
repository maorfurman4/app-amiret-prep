'use client';

export const dynamic = 'force-dynamic';

import { Suspense, useState, useEffect, useId, useRef, useCallback } from 'react';
import { createClient } from '@/lib/supabase';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import type { Session } from '@supabase/supabase-js';
import { UserCircle, Mail, Lock, ArrowRight, Check, ShieldCheck } from 'lucide-react';
import { safeRedirectPath } from '@/lib/safe-redirect';
import { mergeGuestProgress } from '@/lib/merge-guest-client';
import { clearGuestIdentity } from '@/lib/guest';
import { clearLocalLearningData } from '@/lib/local-learning-data';
import { authCallbackUrl } from '@/lib/auth-redirect';
import { MIN_PASSWORD_LENGTH } from '@/lib/password-recovery';
import {
  ALREADY_REGISTERED_MESSAGE,
  classifySignInError,
  classifySignUpError,
  signUpHitExistingAccount,
  validateEmail,
  validatePassword,
} from '@/lib/auth-messages';
import {
  AuthField,
  AuthHeading,
  AuthShell,
  Divider,
  FormAlert,
  GoogleButton,
  PrimaryButton,
  SecondaryButton,
  Spinner,
  StatusView,
  TextButton,
} from '@/components/auth/AuthUI';
import { CheckEmailView } from '@/components/auth/CheckEmailView';

type Mode = 'login' | 'signup';
type View = 'form' | 'forgot' | 'forgot-sent' | 'check-email';
type Alert = { tone: 'error' | 'info'; message: string; action?: 'resend-confirmation' | 'go-login' | 'go-forgot' };

const COPY: Record<Mode, { title: string; subtitle: string; submit: string; busy: string }> = {
  login: { title: 'ברוך שובך', subtitle: 'ממשיכים בדיוק מאיפה שעצרת', submit: 'כניסה', busy: 'נכנסים…' },
  signup: { title: 'יצירת חשבון', subtitle: 'חינם. ההתקדמות נשמרת בכל מכשיר', submit: 'יצירת חשבון', busy: 'יוצרים חשבון…' },
};

function LoginForm({ onSignedInChange }: { onSignedInChange: (signedIn: boolean) => void }) {
  const supabase = createClient();
  const router = useRouter();
  const params = useSearchParams();
  const next = safeRedirectPath(params.get('next'));

  const [mode, setMode] = useState<Mode>(params.get('mode') === 'signup' ? 'signup' : 'login');
  const [view, setView] = useState<View>(params.get('view') === 'forgot' ? 'forgot' : 'form');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [touched, setTouched] = useState<{ email: boolean; password: boolean }>({ email: false, password: false });
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [finishing, setFinishing] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [alert, setAlert] = useState<Alert | null>(null);
  const [session, setSession] = useState<Session | null | undefined>(undefined);

  const uid = useId();
  const ids = { email: `${uid}-email`, password: `${uid}-password`, panel: `${uid}-panel`, alert: `${uid}-alert` };
  const emailRef = useRef<HTMLInputElement>(null);
  const passwordRef = useRef<HTMLInputElement>(null);
  const tabRefs = useRef<Record<Mode, HTMLButtonElement | null>>({ login: null, signup: null });

  // Local session check only decides which screen to show — instant, no
  // network round-trip before the form appears.
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session ?? null));
  }, [supabase.auth]);

  // "Continue without an account" makes no sense to someone already in one.
  useEffect(() => { onSignedInChange(!!session || finishing); }, [session, finishing, onSignedInChange]);

  // Errors appear once a field has been left (or on submit), never while the
  // user is still typing their first attempt.
  const emailError = touched.email || submitted ? validateEmail(email) : null;
  const passwordError = touched.password || submitted ? validatePassword(password, mode) : null;

  const finishLogin = useCallback(async ({ access_token: accessToken, user }: Session) => {
    setFinishing(true);
    // The merge never blocks: it answers fast when there's nothing to move,
    // and a transient failure is retried quietly on the next page load.
    await mergeGuestProgress(accessToken, user.id);
    router.replace(next);
  }, [next, router]);

  // Confirming the email in another tab of this browser signs this tab in
  // too (supabase-js broadcasts the session) — carry on from here.
  useEffect(() => {
    if (view !== 'check-email') return;
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, s) => {
      if (event === 'SIGNED_IN' && s) void finishLogin(s);
    });
    return () => subscription.unsubscribe();
  }, [view, supabase.auth, finishLogin]);

  const switchMode = (m: Mode, opts: { keepAlert?: boolean } = {}) => {
    setMode(m);
    setSubmitted(false);
    setTouched({ email: false, password: false });
    if (!opts.keepAlert) setAlert(null);
  };

  const onTabKey = (e: React.KeyboardEvent) => {
    if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(e.key)) return;
    e.preventDefault();
    const target: Mode = mode === 'login' ? 'signup' : 'login';
    switchMode(target);
    tabRefs.current[target]?.focus();
  };

  const confirmRedirect = () => authCallbackUrl(window.location.origin, next, 'signup');

  const resendConfirmation = async () => {
    const { error } = await supabase.auth.resend({ type: 'signup', email: email.trim(), options: { emailRedirectTo: confirmRedirect() } });
    return !error;
  };

  const sendReset = async () => {
    const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
      redirectTo: authCallbackUrl(window.location.origin, '/auth/reset-password', 'recovery'),
    });
    return !error;
  };

  const handleGoogle = async () => {
    setGoogleLoading(true);
    setAlert(null);
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: authCallbackUrl(window.location.origin, next, 'oauth') },
    });
    if (error) {
      setAlert({ tone: 'error', message: 'לא הצלחנו לפתוח את הכניסה עם Google. נסה שוב.' });
      setGoogleLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitted(true);
    setAlert(null);
    const eErr = validateEmail(email);
    const pErr = validatePassword(password, mode);
    if (eErr) { emailRef.current?.focus(); return; }
    if (pErr) { passwordRef.current?.focus(); return; }

    setLoading(true);
    const cleanEmail = email.trim();
    try {
      if (mode === 'signup') {
        const { data, error } = await supabase.auth.signUp({
          email: cleanEmail,
          password,
          options: { emailRedirectTo: confirmRedirect() },
        });
        if (error) {
          const failure = classifySignUpError(error);
          setAlert({ tone: 'error', message: failure.message, action: failure.kind === 'already_registered' ? 'go-login' : undefined });
        } else if (data.session) {
          // Email confirmation off: signed in straight away.
          await finishLogin(data.session);
          return;
        } else if (signUpHitExistingAccount(data.user)) {
          setAlert({ tone: 'info', message: ALREADY_REGISTERED_MESSAGE, action: 'go-login' });
        } else {
          setView('check-email');
        }
      } else {
        const { data, error } = await supabase.auth.signInWithPassword({ email: cleanEmail, password });
        if (error) {
          const failure = classifySignInError(error);
          setAlert({
            tone: failure.kind === 'email_not_confirmed' ? 'info' : 'error',
            message: failure.message,
            action: failure.kind === 'email_not_confirmed' ? 'resend-confirmation'
              : failure.kind === 'invalid_credentials' ? 'go-forgot' : undefined,
          });
          if (failure.kind === 'invalid_credentials') passwordRef.current?.select();
        } else if (data.session) {
          await finishLogin(data.session);
          return;
        }
      }
    } catch {
      setAlert({ tone: 'error', message: 'אין חיבור לשרת כרגע. כדאי לבדוק את האינטרנט ולנסות שוב.' });
    }
    setLoading(false);
  };

  const handleForgot = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitted(true);
    setAlert(null);
    if (validateEmail(email)) { emailRef.current?.focus(); return; }
    setLoading(true);
    const ok = await sendReset();
    setLoading(false);
    if (ok) setView('forgot-sent');
    else setAlert({ tone: 'error', message: 'לא הצלחנו לשלוח את המייל כרגע. כדאי לחכות דקה ולנסות שוב.' });
  };

  const handleSignOut = async () => {
    // The device's copy of this account's lists must not reach the next sign-in.
    clearLocalLearningData();
    await supabase.auth.signOut();
    await clearGuestIdentity();
    setSession(null);
  };

  // Move focus to the new heading whenever the card swaps content, so
  // screen-reader and keyboard users land on what just appeared.
  useEffect(() => {
    if (view === 'check-email' || view === 'forgot-sent') document.getElementById('check-email-heading')?.focus();
  }, [view]);

  // ── Signing in: hold a calm state while the merge + navigation finish ────
  if (finishing) {
    return (
      <div className="py-10 flex flex-col items-center gap-3 text-exam-ink-soft" role="status">
        <Spinner className="w-8 h-8 text-exam-accent" />
        <p className="text-sm">מחוברים! מעבירים אותך…</p>
      </div>
    );
  }

  if (session === undefined) {
    return <div className="py-10 flex justify-center text-exam-accent" role="status" aria-label="טוען"><Spinner className="w-8 h-8" /></div>;
  }

  if (session) {
    return (
      <StatusView
        icon={UserCircle}
        title="כבר מחובר"
        actions={
          <>
            <PrimaryButton onClick={() => router.push(next)}>המשך לאתר</PrimaryButton>
            <SecondaryButton onClick={handleSignOut}>יציאה והתחברות לחשבון אחר</SecondaryButton>
          </>
        }
      >
        <p>
          מחובר בתור<br />
          <bdi dir="ltr" className="font-bold text-exam-ink break-all">{session.user.email}</bdi>
        </p>
      </StatusView>
    );
  }

  if (view === 'check-email') {
    return (
      <CheckEmailView
        email={email.trim()}
        purpose="confirm"
        onResend={resendConfirmation}
        onChangeEmail={() => { setView('form'); setMode('signup'); setTimeout(() => emailRef.current?.focus(), 0); }}
      />
    );
  }

  if (view === 'forgot-sent') {
    return (
      <div className="space-y-4">
        <CheckEmailView
          email={email.trim()}
          purpose="reset"
          onResend={sendReset}
          onChangeEmail={() => { setView('forgot'); setTimeout(() => emailRef.current?.focus(), 0); }}
        />
        <BackToLogin onClick={() => { setView('form'); switchMode('login'); }} />
      </div>
    );
  }

  if (view === 'forgot') {
    return (
      <form onSubmit={handleForgot} noValidate className="space-y-5">
        <AuthHeading title="שכחת סיסמה?" subtitle="נשלח לך מייל עם קישור לבחירת סיסמה חדשה" />
        <AuthField
          ref={emailRef}
          id={ids.email} label="אימייל" icon={Mail} type="email" name="email" inputMode="email"
          autoComplete="email" placeholder="name@email.com" autoFocus
          value={email} onChange={e => setEmail(e.target.value)}
          onBlur={() => setTouched(t => ({ ...t, email: true }))}
          error={emailError}
        />
        {alert && <FormAlert tone={alert.tone}>{alert.message}</FormAlert>}
        <PrimaryButton type="submit" loading={loading} loadingLabel="שולחים…">שליחת קישור</PrimaryButton>
        <BackToLogin onClick={() => { setView('form'); switchMode('login'); }} />
      </form>
    );
  }

  const copy = COPY[mode];
  const passwordOk = mode === 'signup' && password.length >= MIN_PASSWORD_LENGTH;

  return (
    <div className="space-y-5">
      <div role="tablist" aria-label="כניסה או הרשמה" className="grid grid-cols-2 gap-1 rounded-xl bg-exam-paper-alt p-1 shadow-pressed">
        {(['login', 'signup'] as const).map(m => (
          <button
            key={m}
            ref={el => { tabRefs.current[m] = el; }}
            type="button"
            role="tab"
            id={`${uid}-tab-${m}`}
            aria-selected={mode === m}
            aria-controls={ids.panel}
            tabIndex={mode === m ? 0 : -1}
            onClick={() => switchMode(m)}
            onKeyDown={onTabKey}
            className={`h-10 rounded-lg text-sm transition-[background-color,color,box-shadow] focus-visible:outline-2 focus-visible:outline-exam-accent ${
              mode === m ? 'bg-exam-surface text-exam-ink font-bold shadow-surface' : 'text-exam-ink-soft font-semibold hover:text-exam-ink'
            }`}
          >
            {m === 'login' ? 'כניסה' : 'הרשמה'}
          </button>
        ))}
      </div>

      <div id={ids.panel} role="tabpanel" aria-labelledby={`${uid}-tab-${mode}`} className="space-y-5">
        <AuthHeading title={copy.title} subtitle={copy.subtitle} />

        <GoogleButton onClick={handleGoogle} loading={googleLoading} disabled={loading} />

        <Divider label="או עם אימייל" />

        <form onSubmit={handleSubmit} noValidate className="space-y-4">
          <AuthField
            ref={emailRef}
            id={ids.email} label="אימייל" icon={Mail} type="email" name="email" inputMode="email"
            autoComplete={mode === 'signup' ? 'email' : 'username'} placeholder="name@email.com"
            value={email} onChange={e => setEmail(e.target.value)}
            onBlur={() => setTouched(t => ({ ...t, email: true }))}
            error={emailError}
          />
          <AuthField
            ref={passwordRef}
            id={ids.password} label="סיסמה" icon={Lock} type="password" name="password" revealable
            autoComplete={mode === 'signup' ? 'new-password' : 'current-password'} placeholder="••••••••"
            value={password} onChange={e => setPassword(e.target.value)}
            onBlur={() => setTouched(t => ({ ...t, password: true }))}
            error={passwordError}
            aside={mode === 'login' ? (
              <TextButton onClick={() => { setView('forgot'); setAlert(null); setSubmitted(false); }}>שכחת סיסמה?</TextButton>
            ) : undefined}
            hint={mode === 'signup' ? (
              <span className={`inline-flex items-center gap-1 ${passwordOk ? 'text-exam-sage' : ''}`}>
                {passwordOk && <Check className="w-3.5 h-3.5" aria-hidden />}לפחות {MIN_PASSWORD_LENGTH} תווים
              </span>
            ) : undefined}
          />

          {alert && (
            <FormAlert
              id={ids.alert}
              tone={alert.tone}
              action={
                alert.action === 'resend-confirmation' ? (
                  <TextButton onClick={async () => { if (await resendConfirmation()) setView('check-email'); else setAlert({ tone: 'error', message: 'לא הצלחנו לשלוח שוב כרגע. כדאי לחכות דקה ולנסות שוב.' }); }}>
                    שליחת קישור אישור חדש
                  </TextButton>
                ) : alert.action === 'go-login' ? (
                  <TextButton onClick={() => switchMode('login', { keepAlert: false })}>מעבר לכניסה</TextButton>
                ) : alert.action === 'go-forgot' ? (
                  <TextButton onClick={() => { setView('forgot'); setAlert(null); setSubmitted(false); }}>איפוס סיסמה</TextButton>
                ) : undefined
              }
            >
              {alert.message}
            </FormAlert>
          )}

          <PrimaryButton type="submit" loading={loading} loadingLabel={copy.busy} disabled={googleLoading}>{copy.submit}</PrimaryButton>
        </form>

        {mode === 'signup' && (
          <p className="flex items-center justify-center gap-1.5 text-xs text-exam-ink-soft">
            <ShieldCheck className="w-4 h-4 text-exam-sage shrink-0" aria-hidden />
            ההתקדמות שצברת כאורח עוברת לחשבון אוטומטית
          </p>
        )}
      </div>
    </div>
  );
}

function BackToLogin({ onClick }: { onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} className="hit-44 w-full flex items-center justify-center gap-1.5 text-sm font-semibold text-exam-ink-soft hover:text-exam-ink rounded-sm focus-visible:outline-2 focus-visible:outline-exam-accent">
      <ArrowRight className="w-4 h-4" aria-hidden />חזרה לכניסה
    </button>
  );
}

function LoginScreen() {
  const [signedIn, setSignedIn] = useState(false);
  return (
    <AuthShell
      srTitle="134+: כניסה או הרשמה"
      footer={signedIn ? undefined : (
        <p>
          אפשר גם{' '}
          <Link href="/" className="font-semibold text-exam-ink underline underline-offset-2 hover:text-exam-accent">להמשיך בלי חשבון</Link>
          {' '}— ההתקדמות תישמר רק בדפדפן הזה.
        </p>
      )}
    >
      <LoginForm onSignedInChange={setSignedIn} />
    </AuthShell>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={<AuthShell srTitle="134+: כניסה או הרשמה"><div className="py-10 flex justify-center text-exam-accent"><Spinner className="w-8 h-8" /></div></AuthShell>}>
      <LoginScreen />
    </Suspense>
  );
}
