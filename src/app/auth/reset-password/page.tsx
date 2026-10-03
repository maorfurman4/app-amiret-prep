'use client';

export const dynamic = 'force-dynamic';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Clock, CheckCircle2, Lock, Check } from 'lucide-react';
import { AuthField, AuthHeading, AuthShell, FormAlert, PrimaryButton, Spinner, StatusView } from '@/components/auth/AuthUI';
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
  const [touched, setTouched] = useState({ password: false, confirm: false });
  const [submitted, setSubmitted] = useState(false);

  const passwordOk = password.length >= MIN_PASSWORD_LENGTH;
  const passwordError = (touched.password || submitted) && !passwordOk
    ? (password ? `לפחות ${MIN_PASSWORD_LENGTH} תווים (חסרים עוד ${MIN_PASSWORD_LENGTH - password.length})` : 'צריך למלא סיסמה חדשה')
    : null;
  const confirmError = (touched.confirm || submitted) && passwordOk && confirm !== password
    ? 'הסיסמאות לא זהות' : null;

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
    setSubmitted(true);
    // Field-level messages above already say what's wrong.
    if (validateNewPassword(password, confirm)) return;
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
      setError('אין חיבור לשרת כרגע. כדאי לבדוק את האינטרנט ולנסות שוב.');
    } finally {
      setSaving(false);
    }
  };

  const card = (() => {
    if (phase === 'checking') {
      return (
        <div className="py-8 flex flex-col items-center gap-3" role="status">
          <Spinner className="w-8 h-8 text-exam-accent" />
          <p className="text-exam-ink-soft text-sm">בודקים את הקישור…</p>
        </div>
      );
    }

    if (phase === 'invalid') {
      return (
        <StatusView
          icon={Clock}
          tone="warning"
          title="הקישור כבר לא בתוקף"
          actions={<PrimaryButton onClick={() => router.push('/auth/login?view=forgot')}>לבקשת קישור חדש</PrimaryButton>}
        >
          <p>קישור האיפוס פג תוקף או שכבר נעשה בו שימוש. אפשר לבקש קישור חדש — זה לוקח רגע.</p>
        </StatusView>
      );
    }

    if (phase === 'done') {
      return (
        <StatusView
          icon={CheckCircle2}
          tone="success"
          title="הסיסמה עודכנה"
          actions={<PrimaryButton onClick={() => router.push('/')}>המשך לאתר</PrimaryButton>}
        >
          <p>מעכשיו נכנסים עם הסיסמה החדשה. כבר חיברנו אותך.</p>
        </StatusView>
      );
    }

    return (
      <form onSubmit={handleSubmit} noValidate className="space-y-5">
        <AuthHeading title="בחירת סיסמה חדשה" subtitle="כמעט סיימנו — עוד רגע ונכנסים" />
        <AuthField
          id="new-password" label="סיסמה חדשה" icon={Lock} type="password" revealable autoFocus
          autoComplete="new-password" placeholder="••••••••"
          value={password} onChange={e => setPassword(e.target.value)}
          onBlur={() => setTouched(t => ({ ...t, password: true }))}
          error={passwordError}
          hint={
            <span className={`inline-flex items-center gap-1 ${passwordOk ? 'text-exam-sage' : ''}`}>
              {passwordOk && <Check className="w-3.5 h-3.5" aria-hidden />}לפחות {MIN_PASSWORD_LENGTH} תווים
            </span>
          }
        />
        <AuthField
          id="confirm-password" label="אימות סיסמה" icon={Lock} type="password" revealable
          autoComplete="new-password" placeholder="••••••••"
          value={confirm} onChange={e => setConfirm(e.target.value)}
          onBlur={() => setTouched(t => ({ ...t, confirm: true }))}
          error={confirmError}
        />
        {error && <FormAlert tone="error">{error}</FormAlert>}
        <PrimaryButton type="submit" loading={saving} loadingLabel="מעדכנים…">עדכון סיסמה</PrimaryButton>
      </form>
    );
  })();

  return <AuthShell srTitle="134+: בחירת סיסמה חדשה">{card}</AuthShell>;
}
