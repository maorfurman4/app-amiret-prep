'use client';

export const dynamic = 'force-dynamic';

import { Suspense, useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase';
import { useRouter, useSearchParams } from 'next/navigation';
import type { User } from '@supabase/supabase-js';

function LoginForm() {
  const supabase = createClient();
  const router = useRouter();
  const params = useSearchParams();
  const rawNext = params.get('next') ?? '/';
  const next = rawNext.startsWith('/') ? rawNext : '/';

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

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setCurrentUser(data.user ?? null));
  }, []);

  const handleSignOut = async () => {
    await supabase.auth.signOut();
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
        // Email confirmation is disabled on this project — signUp already
        // returns an active session, so there's nothing to "check email" for.
        router.push(next);
      } else {
        setSignUpDone(true);
      }
    } else {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) {
        setError('אימייל או סיסמה שגויים');
      } else {
        router.push(next);
      }
    }
    setLoading(false);
  };

  const handleForgot = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const redirectTo = `${window.location.origin}/auth/callback?next=/`;
    const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo });
    if (error) {
      setError('שגיאה בשליחת המייל, נסה שוב');
    } else {
      setForgotSent(true);
    }
    setLoading(false);
  };

  // ── Already logged in ─────────────────────────────────────────────────────
  if (currentUser) {
    return (
      <div className="text-center space-y-4">
        <div className="text-5xl">👤</div>
        <h2 className="text-xl font-bold text-slate-900">כבר מחובר</h2>
        <p className="text-slate-500 text-sm">
          מחובר בתור<br />
          <span className="font-semibold text-slate-700">{currentUser.email}</span>
        </p>
        <button
          onClick={() => router.push('/')}
          className="w-full py-3 bg-blue-600 text-white rounded-xl font-bold hover:bg-blue-700 transition-colors"
        >
          חזרה לדף הבית
        </button>
        <button
          onClick={handleSignOut}
          className="w-full py-2.5 border border-slate-300 text-slate-600 rounded-xl text-sm hover:bg-slate-50 transition-colors"
        >
          יציאה מהחשבון
        </button>
      </div>
    );
  }

  // Still loading auth state
  if (currentUser === undefined) {
    return <div className="text-center text-slate-400 py-8">טוען...</div>;
  }

  // ── Sign-up success ────────────────────────────────────────────────────────
  if (signUpDone) {
    return (
      <div className="text-center space-y-4">
        <div className="text-5xl">📬</div>
        <h2 className="text-xl font-bold text-slate-900">בדוק את תיבת המייל שלך</h2>
        <p className="text-slate-500 text-sm leading-relaxed">
          שלחנו לך קישור אישור לכתובת<br />
          <span className="font-semibold text-slate-700">{email}</span>
        </p>
        <p className="text-slate-400 text-xs">
          לחץ על הקישור במייל כדי לאמת את החשבון ולהתחיל
        </p>
        <button
          onClick={() => { setSignUpDone(false); setTab('login'); }}
          className="text-sm text-blue-600 hover:underline"
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
        <div className="text-5xl">✉️</div>
        <h2 className="text-xl font-bold text-slate-900">מייל איפוס נשלח</h2>
        <p className="text-slate-500 text-sm">
          שלחנו לך קישור לאיפוס הסיסמה לכתובת<br />
          <span className="font-semibold text-slate-700">{email}</span>
        </p>
        <button
          onClick={() => { setForgotSent(false); setShowForgot(false); }}
          className="text-sm text-blue-600 hover:underline"
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
          <h2 className="text-lg font-bold text-slate-900 mb-1">שכחת סיסמה?</h2>
          <p className="text-slate-500 text-sm">
            הכנס את האימייל שלך ונשלח לך קישור לאיפוס
          </p>
        </div>
        <div className="space-y-1">
          <label className="block text-sm font-medium text-slate-700">אימייל</label>
          <input
            type="email" value={email} onChange={e => setEmail(e.target.value)}
            required dir="ltr" placeholder="your@email.com"
            className="w-full border border-slate-300 rounded-xl px-3 py-2.5 text-sm focus:ring-2 focus:ring-blue-400 outline-none text-left"
          />
        </div>
        {error && <p className="text-red-600 text-sm">{error}</p>}
        <button
          type="submit" disabled={loading}
          className="w-full py-3 bg-blue-600 text-white rounded-xl font-bold hover:bg-blue-700 disabled:opacity-60 transition-colors"
        >
          {loading ? 'שולח...' : 'שלח קישור איפוס'}
        </button>
        <button type="button" onClick={() => setShowForgot(false)} className="w-full text-center text-sm text-slate-500 hover:text-slate-700">
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
        className="w-full py-3 bg-white border-2 border-slate-200 rounded-xl font-semibold text-slate-700 hover:bg-slate-50 hover:border-slate-300 disabled:opacity-60 transition-all flex items-center justify-center gap-3 shadow-sm"
      >
        {googleLoading ? (
          <span className="w-5 h-5 border-2 border-slate-300 border-t-blue-500 rounded-full animate-spin" />
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
        <div className="flex-1 h-px bg-slate-200" />
        <span className="text-xs text-slate-400">או עם אימייל</span>
        <div className="flex-1 h-px bg-slate-200" />
      </div>

      {/* Tabs */}
      <div className="flex rounded-xl bg-slate-100 p-1 gap-1">
        <button
          onClick={() => { setTab('login'); setError(null); }}
          className={`flex-1 py-2 rounded-lg text-sm font-semibold transition-all ${tab === 'login' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500'}`}
        >
          כניסה
        </button>
        <button
          onClick={() => { setTab('signup'); setError(null); }}
          className={`flex-1 py-2 rounded-lg text-sm font-semibold transition-all ${tab === 'signup' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500'}`}
        >
          הרשמה
        </button>
      </div>

      {/* Email/password form */}
      <form onSubmit={handleSubmit} className="space-y-3">
        <div className="space-y-1">
          <label className="block text-sm font-medium text-slate-700">אימייל</label>
          <input
            type="email" value={email} onChange={e => setEmail(e.target.value)}
            required dir="ltr" placeholder="your@email.com" autoComplete="email"
            className="w-full border border-slate-300 rounded-xl px-3 py-2.5 text-sm focus:ring-2 focus:ring-blue-400 outline-none text-left placeholder:text-slate-400"
          />
        </div>
        <div className="space-y-1">
          <label className="block text-sm font-medium text-slate-700">
            סיסמה
            {tab === 'login' && (
              <button
                type="button"
                onClick={() => { setShowForgot(true); setError(null); }}
                className="float-left text-xs text-blue-600 hover:underline font-normal"
              >
                שכחת סיסמה?
              </button>
            )}
          </label>
          <input
            type="password" value={password} onChange={e => setPassword(e.target.value)}
            required minLength={6} dir="ltr" placeholder="••••••••" autoComplete={tab === 'signup' ? 'new-password' : 'current-password'}
            className="w-full border border-slate-300 rounded-xl px-3 py-2.5 text-sm focus:ring-2 focus:ring-blue-400 outline-none"
          />
          {tab === 'signup' && (
            <p className="text-xs text-slate-400">לפחות 6 תווים</p>
          )}
        </div>

        {error && (
          <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-xl">
            <span className="text-red-500 flex-shrink-0">⚠️</span>
            <p className="text-red-700 text-sm">{error}</p>
          </div>
        )}

        <button
          type="submit" disabled={loading}
          className="w-full py-3 bg-blue-600 text-white rounded-xl font-bold hover:bg-blue-700 disabled:opacity-60 transition-colors flex items-center justify-center gap-2"
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
    <div className="min-h-screen bg-gradient-to-b from-slate-900 to-slate-800 flex items-center justify-center px-4 py-12" dir="rtl">
      <div className="w-full max-w-sm">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="text-5xl mb-3">🎓</div>
          <h1 className="text-4xl font-black text-white tracking-tight" dir="ltr">
            134<span className="text-blue-400">+</span>
          </h1>
          <p className="text-slate-400 text-sm mt-2">ההכנה המדויקת ביותר לאמירנ&quot;ט</p>
        </div>

        {/* Card */}
        <div className="bg-white rounded-3xl p-7 shadow-xl">
          <Suspense fallback={<div className="text-center text-slate-400 py-8">טוען...</div>}>
            <LoginForm />
          </Suspense>
        </div>

        <p className="text-center text-slate-500 text-xs mt-6">
          ניתן להמשיך{' '}
          <a href="/" className="text-slate-300 hover:text-white underline">ללא חשבון</a>
          {' '}— הנתונים נשמרים רק במכשיר זה
        </p>
      </div>
    </div>
  );
}
