'use client';

import { forwardRef, useEffect, useState, type ComponentType, type InputHTMLAttributes, type ReactNode } from 'react';
import Link from 'next/link';
import { AlertCircle, CheckCircle2, Eye, EyeOff, Info } from 'lucide-react';
import { BrandLogo } from '@/components/BrandLogo';

/**
 * Shared building blocks for every auth screen (login/signup, forgot,
 * verify-email, callback, reset) so they read as one product: same logo
 * placement, card, field anatomy, buttons and status layout.
 */

type IconType = ComponentType<{ className?: string; 'aria-hidden'?: boolean; strokeWidth?: number }>;

export function AuthShell({ children, footer, srTitle }: { children: ReactNode; footer?: ReactNode; srTitle?: string }) {
  return (
    <main
      id="main"
      data-auth-shell
      dir="rtl"
      className="min-h-dvh bg-exam-paper flex flex-col items-center px-4 pt-10 pb-10 sm:justify-center sm:pt-12"
    >
      <div className="w-full max-w-sm">
        <Link href="/" aria-label="134+ — לדף הבית" className="block w-fit mx-auto rounded-lg focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-exam-accent">
          <BrandLogo className="w-24 h-auto" />
        </Link>
        {srTitle && <h1 className="sr-only">{srTitle}</h1>}
        <div className="mt-6 bg-exam-surface border border-exam-border rounded-2xl shadow-raised p-6 sm:p-7 animate-fade-up">
          {children}
        </div>
        {footer && <div className="mt-5 text-center text-xs text-exam-ink-soft leading-relaxed space-y-2">{footer}</div>}
      </div>
    </main>
  );
}

export function AuthHeading({ title, subtitle, as: Tag = 'h2', id }: { title: string; subtitle?: ReactNode; as?: 'h1' | 'h2'; id?: string }) {
  return (
    <div className="text-center space-y-1">
      <Tag id={id} className="text-2xl font-extrabold text-exam-ink tracking-tight">{title}</Tag>
      {subtitle && <p className="text-sm text-exam-ink-soft leading-relaxed">{subtitle}</p>}
    </div>
  );
}

type FieldProps = Omit<InputHTMLAttributes<HTMLInputElement>, 'id'> & {
  id: string;
  label: string;
  icon: IconType;
  error?: string | null;
  hint?: ReactNode;
  /** Shown to the side of the label (e.g. "forgot password?"). */
  aside?: ReactNode;
  revealable?: boolean;
};

export const AuthField = forwardRef<HTMLInputElement, FieldProps>(function AuthField(
  { id, label, icon: Icon, error, hint, aside, revealable, type = 'text', className, ...input },
  ref,
) {
  const [revealed, setRevealed] = useState(false);
  const errorId = `${id}-error`;
  const hintId = `${id}-hint`;
  const describedBy = [error ? errorId : null, hint ? hintId : null].filter(Boolean).join(' ') || undefined;
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between gap-2">
        <label htmlFor={id} className="text-sm font-semibold text-exam-ink">{label}</label>
        {aside}
      </div>
      <div
        className={`flex items-center gap-2.5 rounded-xl border bg-exam-surface px-3.5 h-12 transition-[border-color,box-shadow] focus-within:ring-2 ${
          error
            ? 'border-exam-wrong focus-within:ring-exam-wrong/30'
            : 'border-exam-border-input focus-within:border-exam-accent focus-within:ring-exam-accent/25'
        }`}
      >
        <Icon className="w-4.5 h-4.5 text-exam-ink-soft shrink-0" aria-hidden />
        <input
          ref={ref}
          id={id}
          type={revealable && revealed ? 'text' : type}
          dir="ltr"
          aria-invalid={!!error}
          aria-describedby={describedBy}
          className={`flex-1 min-w-0 h-full bg-transparent text-exam-ink text-left outline-none placeholder:text-exam-ink-soft/70 ${className ?? ''}`}
          {...input}
        />
        {revealable && (
          <button
            type="button"
            onClick={() => setRevealed(r => !r)}
            aria-label={revealed ? 'הסתרת הסיסמה' : 'הצגת הסיסמה'}
            aria-pressed={revealed}
            aria-controls={id}
            className="hit-44 -m-1 p-1 rounded-md text-exam-ink-soft hover:text-exam-ink focus-visible:outline-2 focus-visible:outline-exam-accent"
          >
            {revealed ? <EyeOff className="w-4.5 h-4.5" aria-hidden /> : <Eye className="w-4.5 h-4.5" aria-hidden />}
          </button>
        )}
      </div>
      {error && (
        <p id={errorId} className="flex items-start gap-1.5 text-[13px] leading-snug text-exam-wrong">
          <AlertCircle className="w-3.5 h-3.5 mt-0.5 shrink-0" aria-hidden />{error}
        </p>
      )}
      {hint && !error && <p id={hintId} className="text-[13px] leading-snug text-exam-ink-soft">{hint}</p>}
    </div>
  );
});

const GoogleMark = () => (
  <svg className="w-5 h-5 shrink-0" viewBox="0 0 24 24" aria-hidden>
    <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
    <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
    <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
    <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
  </svg>
);

export function GoogleButton({ onClick, loading, disabled }: { onClick: () => void; loading: boolean; disabled?: boolean }) {
  return (
    <div className="space-y-1.5">
      <button
        type="button"
        onClick={onClick}
        disabled={loading || disabled}
        aria-busy={loading}
        className="w-full h-14 flex items-center justify-center gap-3 rounded-xl border border-exam-border-strong bg-exam-surface text-base font-bold text-exam-ink shadow-surface hover:bg-exam-paper-alt active:shadow-pressed disabled:opacity-60 transition-[background-color,box-shadow] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-exam-accent"
      >
        {loading ? <Spinner /> : <GoogleMark />}
        {loading ? 'מעבירים ל־Google…' : 'המשך עם Google'}
      </button>
      <p className="text-center text-xs text-exam-ink-soft">הכי מהיר — בלי סיסמה לזכור</p>
    </div>
  );
}

export function Spinner({ className = 'w-5 h-5' }: { className?: string }) {
  return <span aria-hidden className={`${className} inline-block rounded-full border-2 border-current border-t-transparent opacity-70 animate-spin`} />;
}

export function PrimaryButton({ children, loading, loadingLabel, ...props }: React.ButtonHTMLAttributes<HTMLButtonElement> & { loading?: boolean; loadingLabel?: string }) {
  return (
    <button
      {...props}
      disabled={loading || props.disabled}
      aria-busy={loading || undefined}
      className="w-full h-12 flex items-center justify-center gap-2 rounded-xl bg-exam-accent text-exam-accent-ink font-bold shadow-raised hover:opacity-95 active:shadow-pressed disabled:opacity-60 transition-[opacity,box-shadow] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-exam-accent"
    >
      {loading && <Spinner className="w-4 h-4" />}
      {loading && loadingLabel ? loadingLabel : children}
    </button>
  );
}

export function SecondaryButton({ children, ...props }: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      type="button"
      {...props}
      className="w-full h-11 flex items-center justify-center gap-2 rounded-xl border border-exam-border bg-transparent text-sm font-semibold text-exam-ink hover:bg-exam-paper-alt disabled:opacity-60 disabled:hover:bg-transparent transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-exam-accent"
    >
      {children}
    </button>
  );
}

export function TextButton({ children, className = '', ...props }: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      type="button"
      {...props}
      className={`hit-44 text-[13px] font-semibold text-exam-accent hover:underline underline-offset-2 rounded-sm focus-visible:outline-2 focus-visible:outline-exam-accent ${className}`}
    >
      {children}
    </button>
  );
}

export function Divider({ label }: { label: string }) {
  return (
    <div className="flex items-center gap-3" aria-hidden>
      <div className="flex-1 h-px bg-exam-border" />
      <span className="text-xs text-exam-ink-soft">{label}</span>
      <div className="flex-1 h-px bg-exam-border" />
    </div>
  );
}

type Tone = 'error' | 'info' | 'success';
const TONES: Record<Tone, { box: string; icon: IconType }> = {
  error: { box: 'bg-exam-wrong-bg border-exam-wrong/35 text-exam-wrong', icon: AlertCircle },
  info: { box: 'bg-exam-alt-bg border-exam-alt/35 text-exam-ink', icon: Info },
  success: { box: 'bg-exam-sage-bg border-exam-sage/35 text-exam-ink', icon: CheckCircle2 },
};

/** Form-level message (anything not tied to one field). */
export function FormAlert({ tone, children, action, id }: { tone: Tone; children: ReactNode; action?: ReactNode; id?: string }) {
  const { box, icon: Icon } = TONES[tone];
  return (
    <div id={id} role={tone === 'error' ? 'alert' : 'status'} className={`flex gap-2.5 rounded-xl border p-3.5 text-sm leading-relaxed ${box}`}>
      <Icon className="w-4.5 h-4.5 mt-0.5 shrink-0" aria-hidden />
      <div className="space-y-2">
        <p>{children}</p>
        {action}
      </div>
    </div>
  );
}

/** Centered icon + heading + body — for "check your email", "done", "expired" etc. */
export function StatusView({ icon: Icon, tone = 'neutral', title, children, actions, headingId }: {
  icon: IconType; tone?: 'neutral' | 'success' | 'warning'; title: string; children?: ReactNode; actions?: ReactNode; headingId?: string;
}) {
  const ring = tone === 'success' ? 'bg-exam-sage-bg text-exam-sage' : tone === 'warning' ? 'bg-exam-alt-bg text-exam-alt' : 'bg-exam-paper-alt text-exam-accent';
  return (
    <div className="text-center space-y-4">
      <div className={`mx-auto w-16 h-16 rounded-full flex items-center justify-center ${ring}`}>
        <Icon className="w-8 h-8" strokeWidth={1.75} aria-hidden />
      </div>
      <h2 id={headingId} tabIndex={-1} className="text-2xl font-extrabold text-exam-ink tracking-tight outline-none">{title}</h2>
      {children && <div className="text-[15px] text-exam-ink-soft leading-relaxed space-y-3">{children}</div>}
      {actions && <div className="space-y-2.5 pt-1">{actions}</div>}
    </div>
  );
}

/**
 * "Send again" with a cooldown, so an impatient double-tap can't burn
 * through the auth server's email rate limit. Starts cooling down
 * immediately (an email was just sent by whatever showed this button).
 */
export function ResendButton({ onResend, cooldownSeconds = 60, startCooling = true }: {
  onResend: () => Promise<boolean>; cooldownSeconds?: number; startCooling?: boolean;
}) {
  const [left, setLeft] = useState(startCooling ? cooldownSeconds : 0);
  const [state, setState] = useState<'idle' | 'sending' | 'sent' | 'failed'>('idle');
  useEffect(() => {
    if (left <= 0) return;
    const t = setTimeout(() => setLeft(s => s - 1), 1000);
    return () => clearTimeout(t);
  }, [left]);

  const send = async () => {
    setState('sending');
    const ok = await onResend();
    setState(ok ? 'sent' : 'failed');
    if (ok) setLeft(cooldownSeconds);
  };

  const mmss = `${Math.floor(left / 60)}:${String(left % 60).padStart(2, '0')}`;
  return (
    <div className="space-y-1.5">
      <SecondaryButton onClick={send} disabled={left > 0 || state === 'sending'}>
        {state === 'sending' ? <><Spinner className="w-4 h-4" />שולחים…</> : left > 0 ? `שליחה מחדש (אפשר בעוד ${mmss})` : 'שליחה מחדש'}
      </SecondaryButton>
      <p role="status" className="text-xs min-h-4 text-exam-ink-soft">
        {state === 'sent' ? 'שלחנו שוב. המייל אמור להגיע תוך דקה.' : state === 'failed' ? 'השליחה לא הצליחה. כדאי לחכות דקה ולנסות שוב.' : ''}
      </p>
    </div>
  );
}
