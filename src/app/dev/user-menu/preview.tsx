'use client';

import type { User } from '@supabase/supabase-js';
import { UserMenu } from '@/components/UserMenu';
import { ThemeToggle } from '@/components/ThemeToggle';
import { useEffect } from 'react';
import { installProfileStub, removeStubSession, writeStubSession, STUB_USER_ID } from './stub';

// Must run before UserMenu (or anything else) creates the Supabase client.
installProfileStub();

const MOCK_USER = {
  id: STUB_USER_ID,
  email: 'student@example.com',
  app_metadata: { provider: 'email' },
  user_metadata: { full_name: 'נועה לוי' },
  aud: 'authenticated',
  created_at: '2026-01-01T00:00:00.000Z',
} as unknown as User;

/**
 * Dev-only: the real UserMenu against an in-browser stub (see ./stub.ts),
 * placed inside the same animated top bar as the home page — the stacking
 * context that used to trap the dropdown under the cards below it.
 * ?guest=1 renders the signed-out state through the real auth subscription.
 */
export function UserMenuPreview({ guest }: { guest: boolean }) {
  // Leaving by client-side navigation (e.g. the menu's own links) doesn't fire
  // pagehide; re-writing on mount also survives Strict Mode's double effect.
  useEffect(() => {
    if (!guest) writeStubSession();
    return removeStubSession;
  }, [guest]);
  return (
    <div className="min-h-dvh bg-exam-paper flex flex-col items-center px-4 pt-4 pb-8 text-exam-ink" dir="rtl">
      <div className="w-full max-w-lg space-y-7">
        <div className="flex items-center justify-end gap-2 animate-fade-up [&_a]:text-exam-ink-soft [&_a:hover]:text-exam-ink [&_a:hover]:bg-exam-paper-alt">
          <div className="me-auto text-sm font-bold">/dev/user-menu</div>
          <UserMenu previewUser={guest ? undefined : MOCK_USER} />
          <ThemeToggle />
        </div>
        {[0, 1, 2].map(i => (
          <div
            key={i}
            className="animate-fade-up rounded-2xl border border-exam-border bg-exam-surface p-6 shadow-surface"
            style={{ animationDelay: `${60 * (i + 1)}ms` }}
          >
            <div className="h-4 w-1/2 rounded bg-exam-paper-alt mb-3" />
            <div className="h-3 w-3/4 rounded bg-exam-paper-alt mb-2" />
            <div className="h-3 w-2/3 rounded bg-exam-paper-alt" />
          </div>
        ))}
      </div>
    </div>
  );
}
