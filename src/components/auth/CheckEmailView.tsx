'use client';

import { MailCheck, ExternalLink } from 'lucide-react';
import { inboxFor } from '@/lib/auth-messages';
import { ResendButton, StatusView, TextButton } from './AuthUI';

/**
 * "We sent you an email" — shared by sign-up confirmation and password
 * reset. One tap to the user's webmail when we recognise the provider, a
 * rate-limited resend, the spam hint, and a way back to fix a typo'd address.
 */
export function CheckEmailView({ email, purpose, onResend, onChangeEmail }: {
  email: string;
  purpose: 'confirm' | 'reset';
  onResend: () => Promise<boolean>;
  onChangeEmail: () => void;
}) {
  const inbox = inboxFor(email);
  const confirm = purpose === 'confirm';
  return (
    <StatusView
      icon={MailCheck}
      tone="success"
      title={confirm ? 'כמעט סיימנו' : 'שלחנו לך קישור'}
      headingId="check-email-heading"
      actions={
        <>
          {inbox && (
            <a
              href={inbox.url}
              target="_blank"
              rel="noopener noreferrer"
              className="w-full h-12 flex items-center justify-center gap-2 rounded-xl bg-exam-accent text-exam-accent-ink font-bold shadow-raised hover:opacity-95 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-exam-accent"
            >
              {inbox.label}<ExternalLink className="w-4 h-4" aria-hidden />
            </a>
          )}
          <ResendButton onResend={onResend} />
        </>
      }
    >
      <p>
        {confirm ? 'שלחנו קישור לאישור החשבון אל' : 'אם הכתובת רשומה אצלנו, שלחנו קישור לבחירת סיסמה חדשה אל'}
        <br />
        <bdi dir="ltr" className="font-bold text-exam-ink break-all">{email}</bdi>
      </p>
      <ol className="text-right text-sm text-exam-ink bg-exam-paper-alt rounded-xl p-4 space-y-1.5 list-none">
        <li>1. פותחים את המייל מ־134+</li>
        <li>2. לוחצים על הקישור שבו</li>
        <li>3. {confirm ? 'חוזרים לכאן מחוברים — ומתחילים' : 'בוחרים סיסמה חדשה — וזהו'}</li>
      </ol>
      <p className="text-xs">
        לא מוצא? כדאי לבדוק בספאם או בתיקיית קידומי מכירות.{' '}
        <TextButton onClick={onChangeEmail} className="text-xs">כתובת שגויה?</TextButton>
      </p>
    </StatusView>
  );
}
