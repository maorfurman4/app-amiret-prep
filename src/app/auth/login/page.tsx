'use client';

export const dynamic = 'force-dynamic';

import { Suspense, useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import type { User } from '@supabase/supabase-js';
import { UserCircle, Mail, AlertCircle, GraduationCap, RotateCcw } from 'lucide-react';
import { safeRedirectPath } from '@/lib/safe-redirect';
import { mergeGuestProgress } from '@/lib/merge-guest-client';
import { clearGuestIdentity } from '@/lib/guest';

function LoginForm() {
  const supabase = createClient();
  const router = useRouter();
  const params = useSearchParams();
  const next = safeRedirectPath(params.get('next'));

  const [tab, setTab] = useState<'login' | 'signup'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [signUpDone, setSignUpDone] = useState(false);
  const [forgotSent, setForgotSent] = useState(false);
  const [showForgot, setShowForgot] = useState(false);
  const [currentUser, setCurrentUser] = useState<User | null | undefined>(undefined);
  // Set only when the post-login guest-data merge fails after its retries —
  // holds the access token so "try again" can re-run just the merge without
  // asking the user to log in a second time.
  const [mergeFailedToken, setMergeFailedToken] = useState<string | null>(null);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setCurrentUser(data.user ?? null));
  }, [supabase.auth]);

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    await clearGuestIdentity();
    setCurrentUser(null);
  };

  const handleGoogle = async () => {
    setGoogleLoading(true);
    setError(null);
    const redirectTo = `${window.location.origin}/auth/callback?next=${encodeURIComponent(next)}`;
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo },
    });
    if (error) { setError('שגיאה בכניסה עם Google'); setGoogleLoading(false); }
  };

  // Moves guest-mode history (exam sessions, review queue, streak, vocab
  // known/favorites) onto the account before continuing — awaited and
  // retried, because a silently-lost merge here means real study progress
  // (a streak, known words) is gone for good. Only blocks navigation on
  // failure, so the user can still choose to continue without it.
  const finishLogin = async (accessToken: string) => {
    const result = await mergeGuestProgress(accessToken);
    if (!result.ok) {
      setMergeFailedToken(accessToken);
      setLoading(false);
      return;
    }
    setMergeFailedToken(null);
    router.push(next);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    if (tab === 'signup') {
      const { data, error } = await supabase.auth.signUp({ email, password });
      if (error) {
        setError(error.message.includes('already registered')
          ? 'כתובת האימייל הזו כבר רשומה — נסה להתחבר'
          : 'שגיאה בהרשמה, נסה שוב');
      } else if (data.session) {
        // signUp() returns an active session immediately when email
        // confirmation is off; falls to the "check your email" branch
        // below when it's on (as it currently is in production).
        await finishLogin(data.session.access_token);
      } else {
        setSignUpDone(true);
      }
    } else {
      const { data, error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) {
        setError('אימייל או סיסמה שגויים');
      } else if (data.session) {
        await finishLogin(data.session.access_token);
      }
    }
    setLoading(false);
  };

  const handleForgot = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    // Land on the dedicated reset screen (via the callback, which consumes
    // the recovery token from the URL hash) instead of bouncing to home.
    const redirectTo = `${window.location.origin}/auth/callback?next=${encodeURIComponent('/auth/reset-password')}`;
    const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo });
    if (error) {
      setError('שגיאה בשליחת המייל, נסה שוב');
    } else {
      setForgotSent(true);
    }
    setLoading(false);
  };

  // ── Guest-progress merge failed after retries ─────────────────────────────
  // The account itself is already created/signed in at this point — this is
  // purely "we couldn't confirm your streak/vocab progress made it over."
  // Offer a real retry (idempotent server-side) before letting the user
  // continue without it.
  if (mergeFailedToken) {
    return (
      <div className="text-center space-y-4">
        <AlertCircle className="w-12 h-12 mx-auto text-exam-alt" strokeWidth={1.5} aria-hidden />
        <h2 className="text-xl font-bold text-exam-ink">ההתחברות הצליחה</h2>
        <p className="text-exam-ink-soft text-sm leading-relaxed">
          אבל לא הצלחנו לאשר שההתקדמות שצברת כאורח/ת (רצף ימים, מילים שסימנת) הועברה לחשבון.
          הנתונים עדיין נשמרים במכשיר הזה — כדאי לנסות שוב.
        </p>
        <button
          onClick={() => finishLogin(mergeFailedToken)}
          className="w-full py-3 bg-exam-accent text-exam-accent-ink rounded-sm font-bold hover:opacity-90 transition-opacity flex items-center justify-center gap-2"
        >
          <RotateCcw className="w-4 h-4" aria-hidden />נסה שוב
        </button>
        <button
          onClick={() => router.push(next)}
          className="w-full py-2.5 border border-exam-border text-exam-ink-soft rounded-sm text-sm hover:bg-exam-paper-alt transition-colors"
        >
          המשך בלי לשמור כרגע
        </button>
      </div>
    );
  }

  // ── Already logged in ─────────────────────────────────────────────────────
  if (currentUser) {
    return (
      <div className="text-center space-y-4">
        <UserCircle className="w-12 h-12 mx-auto text-exam-ink" strokeWidth={1.5} aria-hidden />
        <h2 className="text-xl font-bold text-exam-ink">כבר מחובר</h2>
        <p className="text-exam-ink-soft text-sm">
          מחובר בתור<br />
          <span className="font-semibold text-exam-ink">{currentUser.email}</span>
        </p>
        <button
          onClick={() => router.push('/')}
          className="w-full py-3 bg-exam-accent text-exam-accent-ink rounded-sm font-bold hover:opacity-90 transition-opacity"
        >
          חזרה לדף הבית
        </button>
        <button
          onClick={handleSignOut}
          className="w-full py-2.5 border border-exam-border text-exam-ink-soft rounded-sm text-sm hover:bg-exam-paper-alt transition-colors"
        >
          יציאה מהחשבון
        </button>
      </div>
    );
  }

  // Still loading auth state
  if (currentUser === undefined) {
    return <div className="text-center text-exam-ink-soft py-8">טוען...</div>;
  }

  // ── Sign-up success ────────────────────────────────────────────────────────
  if (signUpDone) {
    return (
      <div className="text-center space-y-4">
        <Mail className="w-12 h-12 mx-auto text-exam-ink" strokeWidth={1.5} aria-hidden />
        <h2 className="text-xl font-bold text-exam-ink">בדוק את תיבת המייל שלך</h2>
        <p className="text-exam-ink-soft text-sm leading-relaxed">
          שלחנו לך קישור אישור לכתובת<br />
          <span className="font-semibold text-exam-ink">{email}</span>
        </p>
        <p className="text-exam-ink-soft text-xs">
          לחץ על הקישור במייל כדי לאמת את החשבון ולהתחיל
        </p>
        <button
          onClick={() => { setSignUpDone(false); setTab('login'); }}
          className="text-sm text-exam-accent hover:underline"
        >
          חזרה לכניסה
        </button>
      </div>
    );
  }

  // ── Forgot-password success ────────────────────────────────────────────────
  if (forgotSent) {
    return (
      <div className="text-center space-y-4">
        <Mail className="w-12 h-12 mx-auto text-exam-ink" strokeWidth={1.5} aria-hidden />
        <h2 className="text-xl font-bold text-exam-ink">מייל איפוס נשלח</h2>
        <p className="text-exam-ink-soft text-sm">
          שלחנו לך קישור לאיפוס הסיסמה לכתובת<br />
          <span className="font-semibold text-exam-ink">{email}</span>
        </p>
        <button
          onClick={() => { setForgotSent(false); setShowForgot(false); }}
          className="text-sm text-exam-accent hover:underline"
        >
          חזרה לכניסה
        </button>
      </div>
    );
  }

  // ── Forgot password form ───────────────────────────────────────────────────
  if (showForgot) {
    return (
      <form onSubmit={handleForgot} className="space-y-4">
        <div>
          <h2 className="text-lg font-bold text-exam-ink mb-1">שכחת סיסמה?</h2>
          <p className="text-exam-ink-soft text-sm">
            הכנס את האימייל שלך ונשלח לך קישור לאיפוס
          </p>
        </div>
        <div className="space-y-1">
          <label className="block text-sm font-medium text-exam-ink">אימייל</label>
          <input
            type="email" value={email} onChange={e => setEmail(e.target.value)}
            required dir="ltr" placeholder="your@email.com"
            className="w-full border border-exam-border bg-exam-surface text-exam-ink rounded-sm px-3 py-2.5 text-sm focus:ring-2 focus:ring-exam-accent outline-none text-left"
          />
        </div>
        {error && <p className="text-exam-wrong text-sm">{error}</p>}
        <button
          type="submit" disabled={loading}
          className="w-full py-3 bg-exam-accent text-exam-accent-ink rounded-sm font-bold hover:opacity-90 disabled:opacity-60 transition-opacity"
        >
          {loading ? 'שולח...' : 'שלח קישור איפוס'}
        </button>
        <button type="button" onClick={() => setShowForgot(false)} className="w-full text-center text-sm text-exam-ink-soft hover:text-exam-ink">
          ← חזרה לכניסה
        </button>
      </form>
    );
  }

  // ── Main login / signup form ───────────────────────────────────────────────
  return (
    <div className="space-y-4">
      {/* Google button — primary */}
      <button
        onClick={handleGoogle}
        disabled={googleLoading}
        className="w-full py-3 bg-exam-surface border border-exam-border rounded-sm font-semibold text-exam-ink hover:bg-exam-paper-alt hover:border-exam-border-strong disabled:opacity-60 transition-colors flex items-center justify-center gap-3"
      >
        {googleLoading ? (
          <span className="w-5 h-5 border-2 border-exam-border border-t-exam-accent rounded-full animate-spin" />
        ) : (
          <svg className="w-5 h-5 flex-shrink-0" viewBox="0 0 24 24">
            <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
            <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
            <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
            <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
          </svg>
        )}
        {tab === 'signup' ? 'הרשמה עם Google' : 'כניסה עם Google'}
      </button>

      {/* Divider */}
      <div className="flex items-center gap-3">
        <div className="flex-1 h-px bg-exam-border" />
        <span className="text-xs text-exam-ink-soft">או עם אימייל</span>
        <div className="flex-1 h-px bg-exam-border" />
      </div>

      {/* Tabs */}
      <div className="flex rounded-sm bg-exam-paper-alt p-1 gap-1">
        <button
          onClick={() => { setTab('login'); setError(null); }}
          className={`flex-1 py-2 rounded-sm text-sm font-semibold transition-colors ${tab === 'login' ? 'bg-exam-surface text-exam-ink' : 'text-exam-ink-soft'}`}
        >
          כניסה
        </button>
        <button
          onClick={() => { setTab('signup'); setError(null); }}
          className={`flex-1 py-2 rounded-sm text-sm font-semibold transition-colors ${tab === 'signup' ? 'bg-exam-surface text-exam-ink' : 'text-exam-ink-soft'}`}
        >
          הרשמה
        </button>
      </div>

      {/* Email/password form */}
      <form onSubmit={handleSubmit} className="space-y-3">
        <div className="space-y-1">
          <label className="block text-sm font-medium text-exam-ink">אימייל</label>
          <input
            type="email" name="email" value={email} onChange={e => setEmail(e.target.value)}
            required dir="ltr" placeholder="your@email.com" autoComplete="email"
            className="w-full border border-exam-border bg-exam-surface text-exam-ink rounded-sm px-3 py-2.5 text-sm focus:ring-2 focus:ring-exam-accent outline-none text-left placeholder:text-exam-ink-soft"
          />
        </div>
        <div className="space-y-1">
          <label className="block text-sm font-medium text-exam-ink">
            סיסמה
            {tab === 'login' && (
              <button
                type="button"
                onClick={() => { setShowForgot(true); setError(null); }}
                className="float-left text-xs text-exam-accent hover:underline font-normal"
              >
                שכחת סיסמה?
              </button>
            )}
          </label>
          <input
            type="password" name="password" value={password} onChange={e => setPassword(e.target.value)}
            required minLength={6} dir="ltr" placeholder="••••••••" autoComplete={tab === 'signup' ? 'new-password' : 'current-password'}
            className="w-full border border-exam-border bg-exam-surface text-exam-ink rounded-sm px-3 py-2.5 text-sm focus:ring-2 focus:ring-exam-accent outline-none"
          />
          {tab === 'signup' && (
            <p className="text-xs text-exam-ink-soft">לפחות 6 תווים</p>
          )}
        </div>

        {error && (
          <div className="flex items-center gap-2 p-3 bg-exam-wrong-bg border border-exam-wrong/40 rounded-sm">
            <AlertCircle className="w-4 h-4 text-exam-wrong flex-shrink-0" aria-hidden />
            <p className="text-exam-wrong text-sm">{error}</p>
          </div>
        )}

        <button
          type="submit" disabled={loading}
          className="w-full py-3 bg-exam-accent text-exam-accent-ink rounded-sm font-bold hover:opacity-90 disabled:opacity-60 transition-opacity flex items-center justify-center gap-2"
        >
          {loading && <span className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />}
          {loading ? (tab === 'signup' ? 'נרשם...' : 'מתחבר...') : (tab === 'signup' ? 'הרשמה' : 'כניסה')}
        </button>
      </form>
    </div>
  );
}

export default function LoginPage() {
  return (
    <div className="min-h-screen bg-exam-paper flex items-center justify-center px-4 py-12" dir="rtl">
      <div className="w-full max-w-sm">
        {/* Header */}
        <div className="text-center mb-8">
          <GraduationCap className="w-12 h-12 mx-auto mb-3 text-exam-ink" strokeWidth={1.5} aria-hidden />
          <h1 className="text-4xl font-black text-exam-ink tracking-tight" dir="ltr">
            134<span className="text-exam-accent">+</span>
          </h1>
          <p className="text-exam-ink-soft text-sm mt-2">הכנה ממוקדת לאמירנ&quot;ט</p>
        </div>

        {/* Card */}
        <div className="bg-exam-surface border border-exam-border rounded-md p-7">
          <Suspense fallback={<div className="text-center text-exam-ink-soft py-8">טוען...</div>}>
            <LoginForm />
          </Suspense>
        </div>

        <p className="text-center text-exam-ink-soft text-xs mt-6">
          ניתן להמשיך{' '}
          <Link href="/" className="text-exam-ink-soft hover:text-exam-ink underline">ללא חשבון</Link>
          {' '}— ההתקדמות זמינה בדפדפן זה. מחיקת נתוני האתר עלולה לאבד את הגישה אליה
        </p>
      </div>
    </div>
  );
}
