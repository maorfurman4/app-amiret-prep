import { MIN_PASSWORD_LENGTH } from './password-recovery';

/**
 * Pure helpers behind the auth screens: field validation and turning a
 * Supabase auth error into the one message (and next step) the user needs.
 * Kept separate from the pages so each branch is unit-tested — a wrong
 * mapping here is exactly how an unverified account used to be told its
 * password was wrong.
 */

interface AuthErrorLike {
  message?: string;
  status?: number;
  code?: string;
  name?: string;
}

export type SignInFailure =
  | { kind: 'invalid_credentials'; message: string }
  | { kind: 'email_not_confirmed'; message: string }
  | { kind: 'network'; message: string }
  | { kind: 'rate_limited'; message: string }
  | { kind: 'unknown'; message: string };

const NETWORK_MESSAGE = 'אין חיבור לשרת כרגע. כדאי לבדוק את האינטרנט ולנסות שוב.';
const RATE_LIMIT_MESSAGE = 'היו יותר מדי ניסיונות בזמן קצר. כדאי לחכות דקה ולנסות שוב.';

function isNetworkError(error: AuthErrorLike) {
  // supabase-js reports a failed fetch as AuthRetryableFetchError with no
  // HTTP status (or status 0); a 5xx from the auth server is just as
  // "not your fault" from the user's point of view.
  return error.name === 'AuthRetryableFetchError'
    || !error.status
    || error.status >= 500;
}

function isRateLimited(error: AuthErrorLike) {
  return error.status === 429 || (error.code ?? '').startsWith('over_');
}

export function classifySignInError(error: AuthErrorLike): SignInFailure {
  const message = (error.message ?? '').toLowerCase();
  if (error.code === 'email_not_confirmed' || message.includes('email not confirmed')) {
    return {
      kind: 'email_not_confirmed',
      message: 'החשבון עוד לא אושר. שלחנו אליך מייל עם קישור אישור — אחרי הלחיצה עליו אפשר להיכנס.',
    };
  }
  if (isRateLimited(error)) return { kind: 'rate_limited', message: RATE_LIMIT_MESSAGE };
  if (error.code === 'invalid_credentials' || message.includes('invalid login credentials')) {
    return { kind: 'invalid_credentials', message: 'האימייל או הסיסמה לא נכונים.' };
  }
  if (isNetworkError(error)) return { kind: 'network', message: NETWORK_MESSAGE };
  return { kind: 'unknown', message: 'לא הצלחנו להיכנס. נסה שוב בעוד רגע.' };
}

export type SignUpFailure =
  | { kind: 'already_registered'; message: string }
  | { kind: 'weak_password'; message: string }
  | { kind: 'invalid_email'; message: string }
  | { kind: 'network'; message: string }
  | { kind: 'rate_limited'; message: string }
  | { kind: 'unknown'; message: string };

const ALREADY_REGISTERED_MESSAGE = 'כתובת האימייל הזו כבר רשומה. אפשר פשוט להיכנס — או לאפס סיסמה אם שכחת.';

export function classifySignUpError(error: AuthErrorLike): SignUpFailure {
  const message = (error.message ?? '').toLowerCase();
  if (error.code === 'user_already_exists' || error.code === 'email_exists' || message.includes('already registered')) {
    return { kind: 'already_registered', message: ALREADY_REGISTERED_MESSAGE };
  }
  if (error.code === 'weak_password' || message.includes('password should')) {
    return { kind: 'weak_password', message: `הסיסמה חלשה מדי. כדאי לבחור לפחות ${MIN_PASSWORD_LENGTH} תווים, עם אותיות ומספרים.` };
  }
  if (error.code === 'email_address_invalid' || message.includes('invalid format') || (message.includes('email address') && message.includes('invalid'))) {
    return { kind: 'invalid_email', message: 'כתובת האימייל לא תקינה.' };
  }
  if (isRateLimited(error)) return { kind: 'rate_limited', message: RATE_LIMIT_MESSAGE };
  if (message.includes('sending confirmation email')) {
    return { kind: 'unknown', message: 'לא הצלחנו לשלוח את מייל האישור כרגע. נסה שוב בעוד כמה דקות.' };
  }
  if (isNetworkError(error)) return { kind: 'network', message: NETWORK_MESSAGE };
  return { kind: 'unknown', message: 'לא הצלחנו להשלים את ההרשמה. נסה שוב בעוד רגע.' };
}

/**
 * With email confirmation on, Supabase deliberately answers a sign-up for an
 * already-confirmed address with a fake success (no error, no session) so
 * the endpoint can't be used to probe which emails exist. The tell is a
 * user object with an empty `identities` array. Without this check the user
 * waits for a confirmation email that is never sent.
 */
export function signUpHitExistingAccount(user: { identities?: unknown[] | null } | null | undefined) {
  return !!user && Array.isArray(user.identities) && user.identities.length === 0;
}

export { ALREADY_REGISTERED_MESSAGE };

// ── Field validation ────────────────────────────────────────────────────────

// Deliberately loose: the server is the real judge. This only catches the
// obvious slips (missing @, missing domain, stray spaces) before a round-trip.
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

export function validateEmail(raw: string): string | null {
  const email = raw.trim();
  if (!email) return 'צריך למלא כתובת אימייל';
  if (!email.includes('@')) return 'בכתובת אימייל חסר @';
  if (!EMAIL_RE.test(email)) return 'נראה שחסר משהו בכתובת — למשל name@gmail.com';
  return null;
}

export function validatePassword(password: string, mode: 'login' | 'signup'): string | null {
  if (!password) return 'צריך למלא סיסמה';
  if (mode === 'signup' && password.length < MIN_PASSWORD_LENGTH) {
    return `הסיסמה צריכה להכיל לפחות ${MIN_PASSWORD_LENGTH} תווים (חסרים עוד ${MIN_PASSWORD_LENGTH - password.length})`;
  }
  return null;
}

// ── Inbox shortcut ──────────────────────────────────────────────────────────

const INBOXES: { domains: string[]; label: string; url: string }[] = [
  { domains: ['gmail.com', 'googlemail.com'], label: 'פתיחת Gmail', url: 'https://mail.google.com/mail/u/0/#inbox' },
  { domains: ['outlook.com', 'hotmail.com', 'live.com', 'msn.com', 'outlook.co.il', 'hotmail.co.il'], label: 'פתיחת Outlook', url: 'https://outlook.live.com/mail/0/inbox' },
  { domains: ['yahoo.com', 'ymail.com'], label: 'פתיחת Yahoo Mail', url: 'https://mail.yahoo.com/' },
  { domains: ['icloud.com', 'me.com', 'mac.com'], label: 'פתיחת iCloud Mail', url: 'https://www.icloud.com/mail' },
  { domains: ['walla.co.il', 'walla.com'], label: 'פתיחת וואלה מייל', url: 'https://mail.walla.co.il/' },
];

/** The webmail for a known provider, so "go check your email" is one tap. */
export function inboxFor(email: string): { label: string; url: string } | null {
  const domain = email.trim().toLowerCase().split('@')[1];
  if (!domain) return null;
  const match = INBOXES.find(i => i.domains.includes(domain));
  return match ? { label: match.label, url: match.url } : null;
}
