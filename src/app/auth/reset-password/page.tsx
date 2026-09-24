'use client';

export const dynamic = 'force-dynamic';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Clock, CheckCircle2, KeyRound } from 'lucide-react';
import { createClient } from '@/lib/supabase';
import {
  classifyPasswordUpdateError,
  MIN_PASSWORD_LENGTH,
  validateNewPassword,
  recoveryLinkIsInvalid,
} from '@/lib/password-recovery';

type Phase = 'checking' | 'form' | 'done' | 'invalid';

/**
 * Landing page for the "forgot password" email link.
 *
 * The link goes through /auth/callback (which consumes the recovery token from
 * the URL hash and persists the session) and is then routed here. Anyone who
 * reaches this page with a valid session may set a new password; without one
 * the link is stale/used and we say so instead of silently bouncing home.
 */
export default function ResetPasswordPage() {
  const supabase = createClient();
  const router = useRouter();

  const [phase, setPhase] = useState<Phase>('checking');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    if (new URLSearchParams(window.location.search).has('error') || recoveryLinkIsInvalid(window.location.hash)) {
      // An existing sign-in must not hide an explicitly rejected recovery link.
      Promise.resolve().then(() => { if (!cancelled) setPhase('invalid'); });
      return () => { cancelled = true; };
    }

    // Recovery tokens can still be in the hash if the user landed here
    // directly (older email links); detectSessionInUrl processes them and
    // fires SIGNED_IN / PASSWORD_RECOVERY, which we catch below.
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (cancelled) return;
      if ((event === 'PASSWORD_RECOVERY' || event === 'SIGNED_IN') && session) {
        setPhase(p => (p === 'checking' || p === 'invalid' ? 'form' : p));
      }
    });

    supabase.auth.getSession().then(({ data: { session } }) => {
      if (cancelled) return;
      if (session) setPhase(p => (p === 'checking' ? 'form' : p));
    });

    // Give the hash processing a moment; if there is still no session the
    // link is invalid or expired.
    const timer = setTimeout(async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!cancelled && !session) setPhase(p => (p === 'checking' ? 'invalid' : p));
    }, 4000);

    return () => {
      cancelled = true;
      subscription.unsubscribe();
      clearTimeout(timer);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    const validationError = validateNewPassword(password, confirm);
    if (validationError) {
      setError(validationError);
      return;
    }
    setSaving(true);
    try {
    const { error: updateErr } = await supabase.auth.updateUser({ password });
    if (updateErr) {
      // Supabase rejects reusing the current password and expired sessions.
      const failure = classifyPasswordUpdateError(updateErr);
      if (failure.invalidSession) {
        setPhase('invalid');
      } else {
        setError(failure.message);
      }
      return;
    }
    setPhase('done');
    } catch {
      setError('לא הצלחנו להתחבר. בדוק את החיבור ונסה שוב.');
    } finally {
      setSaving(false);
    }
  };

  const card = (() => {
    if (phase === 'checking') {
      return (
        <div className="text-center py-8 space-y-3">
          <div className="w-8 h-8 border-2 border-exam-border border-t-exam-accent rounded-full animate-spin mx-auto" />
          <p className="text-exam-ink-soft text-sm">מאמת את הקישור...</p>
        </div>
      );
    }

    if (phase === 'invalid') {
      return (
        <div className="text-center space-y-4">
          <Clock className="w-12 h-12 mx-auto text-exam-ink" strokeWidth={1.5} aria-hidden />
          <h2 className="text-xl font-bold text-exam-ink">הקישור אינו תקף</h2>
          <p className="text-exam-ink-soft text-sm">
            קישור האיפוס פג תוקף או שכבר נעשה בו שימוש.<br />
            אפשר לבקש קישור חדש ממסך הכניסה.
          </p>
          <button
            onClick={() => router.push('/auth/login')}
            className="w-full py-3 bg-exam-accent text-exam-accent-ink rounded-sm font-bold hover:opacity-90 transition-opacity"
          >
            למסך הכניסה
          </button>
        </div>
      );
    }

    if (phase === 'done') {
      return (
        <div className="text-center space-y-4">
          <CheckCircle2 className="w-12 h-12 mx-auto text-exam-sage-strong" strokeWidth={1.5} aria-hidden />
          <h2 className="text-xl font-bold text-exam-ink">הסיסמה עודכנה</h2>
          <p className="text-exam-ink-soft text-sm">
            מעכשיו נכנסים עם הסיסמה החדשה. אתה כבר מחובר.
          </p>
          <button
            onClick={() => router.push('/')}
            className="w-full py-3 bg-exam-accent text-exam-accent-ink rounded-sm font-bold hover:opacity-90 transition-opacity"
          >
            לדף הבית
          </button>
        </div>
      );
    }

    return (
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <h2 className="text-lg font-bold text-exam-ink mb-1">בחירת סיסמה חדשה</h2>
          <p className="text-exam-ink-soft text-sm">הזן סיסמה חדשה לחשבון שלך</p>
        </div>
        <div className="space-y-1">
          <label htmlFor="new-password" className="block text-sm font-medium text-exam-ink">סיסמה חדשה</label>
          <input
            id="new-password"
            type="password" value={password} onChange={e => setPassword(e.target.value)}
            required minLength={MIN_PASSWORD_LENGTH} dir="ltr" placeholder="••••••••" autoComplete="new-password"
            className="w-full border border-exam-border bg-exam-surface text-exam-ink rounded-sm px-3 py-2.5 text-sm focus:ring-2 focus:ring-exam-accent outline-none text-left"
          />
          <p className="text-xs text-exam-ink-soft">לפחות {MIN_PASSWORD_LENGTH} תווים</p>
        </div>
        <div className="space-y-1">
          <label htmlFor="confirm-password" className="block text-sm font-medium text-exam-ink">אימות סיסמה</label>
          <input
            id="confirm-password"
            type="password" value={confirm} onChange={e => setConfirm(e.target.value)}
            required minLength={MIN_PASSWORD_LENGTH} dir="ltr" placeholder="••••••••" autoComplete="new-password"
            className="w-full border border-exam-border bg-exam-surface text-exam-ink rounded-sm px-3 py-2.5 text-sm focus:ring-2 focus:ring-exam-accent outline-none text-left"
          />
        </div>
        {error && <p className="text-exam-wrong text-sm" role="alert">{error}</p>}
        <button
          type="submit" disabled={saving}
          className="w-full py-3 bg-exam-accent text-exam-accent-ink rounded-sm font-bold hover:opacity-90 disabled:opacity-60 transition-opacity"
        >
          {saving ? 'מעדכן...' : 'עדכן סיסמה'}
        </button>
      </form>
    );
  })();

  return (
    <div className="min-h-dvh bg-exam-paper flex items-center justify-center px-4 py-12" dir="rtl">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <KeyRound className="w-12 h-12 mx-auto mb-3 text-exam-ink" strokeWidth={1.5} aria-hidden />
          <h1 className="text-4xl font-bold text-exam-ink tracking-tight" dir="ltr">
            134<span className="text-exam-accent">+</span>
          </h1>
          <p className="text-exam-ink-soft text-sm mt-2">איפוס סיסמה</p>
        </div>
        <div className="bg-exam-surface border border-exam-border rounded-md p-7">{card}</div>
      </div>
    </div>
  );
}
