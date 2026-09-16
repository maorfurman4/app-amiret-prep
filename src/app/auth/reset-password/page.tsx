'use client';

export const dynamic = 'force-dynamic';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase';

type Phase = 'checking' | 'form' | 'done' | 'invalid';

const MIN_PASSWORD_LENGTH = 6; // matches signup's rule and Supabase's default

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
    if (password.length < MIN_PASSWORD_LENGTH) {
      setError(`הסיסמה חייבת להכיל לפחות ${MIN_PASSWORD_LENGTH} תווים`);
      return;
    }
    if (password !== confirm) {
      setError('הסיסמאות אינן זהות');
      return;
    }
    setSaving(true);
    const { error: updateErr } = await supabase.auth.updateUser({ password });
    setSaving(false);
    if (updateErr) {
      // Supabase rejects reusing the current password and expired sessions.
      const msg = updateErr.message.toLowerCase();
      if (msg.includes('different from the old')) {
        setError('הסיסמה החדשה חייבת להיות שונה מהסיסמה הנוכחית');
      } else if (msg.includes('session') || updateErr.status === 401) {
        setPhase('invalid');
      } else {
        setError('לא הצלחנו לעדכן את הסיסמה, נסה שוב');
      }
      return;
    }
    setPhase('done');
  };

  const card = (() => {
    if (phase === 'checking') {
      return (
        <div className="text-center py-8 space-y-3">
          <div className="w-8 h-8 border-2 border-slate-300 border-t-blue-600 rounded-full animate-spin mx-auto" />
          <p className="text-slate-400 text-sm">מאמת את הקישור...</p>
        </div>
      );
    }

    if (phase === 'invalid') {
      return (
        <div className="text-center space-y-4">
          <div className="text-5xl">⏳</div>
          <h2 className="text-xl font-bold text-slate-900">הקישור אינו תקף</h2>
          <p className="text-slate-500 text-sm">
            קישור האיפוס פג תוקף או שכבר נעשה בו שימוש.<br />
            אפשר לבקש קישור חדש ממסך הכניסה.
          </p>
          <button
            onClick={() => router.push('/auth/login')}
            className="w-full py-3 bg-blue-600 text-white rounded-xl font-bold hover:bg-blue-700 transition-colors"
          >
            למסך הכניסה
          </button>
        </div>
      );
    }

    if (phase === 'done') {
      return (
        <div className="text-center space-y-4">
          <div className="text-5xl">✅</div>
          <h2 className="text-xl font-bold text-slate-900">הסיסמה עודכנה</h2>
          <p className="text-slate-500 text-sm">
            מעכשיו נכנסים עם הסיסמה החדשה. אתה כבר מחובר.
          </p>
          <button
            onClick={() => router.push('/')}
            className="w-full py-3 bg-blue-600 text-white rounded-xl font-bold hover:bg-blue-700 transition-colors"
          >
            לדף הבית
          </button>
        </div>
      );
    }

    return (
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <h2 className="text-lg font-bold text-slate-900 mb-1">בחירת סיסמה חדשה</h2>
          <p className="text-slate-500 text-sm">הזן סיסמה חדשה לחשבון שלך</p>
        </div>
        <div className="space-y-1">
          <label htmlFor="new-password" className="block text-sm font-medium text-slate-700">סיסמה חדשה</label>
          <input
            id="new-password"
            type="password" value={password} onChange={e => setPassword(e.target.value)}
            required minLength={MIN_PASSWORD_LENGTH} dir="ltr" placeholder="••••••••" autoComplete="new-password"
            className="w-full border border-slate-300 rounded-xl px-3 py-2.5 text-sm focus:ring-2 focus:ring-blue-400 outline-none text-left"
          />
          <p className="text-xs text-slate-400">לפחות {MIN_PASSWORD_LENGTH} תווים</p>
        </div>
        <div className="space-y-1">
          <label htmlFor="confirm-password" className="block text-sm font-medium text-slate-700">אימות סיסמה</label>
          <input
            id="confirm-password"
            type="password" value={confirm} onChange={e => setConfirm(e.target.value)}
            required minLength={MIN_PASSWORD_LENGTH} dir="ltr" placeholder="••••••••" autoComplete="new-password"
            className="w-full border border-slate-300 rounded-xl px-3 py-2.5 text-sm focus:ring-2 focus:ring-blue-400 outline-none text-left"
          />
        </div>
        {error && <p className="text-red-600 text-sm" role="alert">{error}</p>}
        <button
          type="submit" disabled={saving}
          className="w-full py-3 bg-blue-600 text-white rounded-xl font-bold hover:bg-blue-700 disabled:opacity-60 transition-colors"
        >
          {saving ? 'מעדכן...' : 'עדכן סיסמה'}
        </button>
      </form>
    );
  })();

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-900 to-slate-800 flex items-center justify-center px-4 py-12" dir="rtl">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <div className="text-5xl mb-3">🔑</div>
          <h1 className="text-4xl font-black text-white tracking-tight" dir="ltr">
            134<span className="text-blue-400">+</span>
          </h1>
          <p className="text-slate-400 text-sm mt-2">איפוס סיסמה</p>
        </div>
        <div className="bg-white rounded-3xl p-7 shadow-xl">{card}</div>
      </div>
    </div>
  );
}
