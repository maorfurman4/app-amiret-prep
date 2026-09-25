'use client';

import { useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabase';
import { Save, ChevronLeft } from 'lucide-react';
import type { User } from '@supabase/supabase-js';

interface AuthCTAProps {
  /** Short line explaining what's at stake right now, e.g. "כדי לא לאבד את התוצאה הזו". */
  message: string;
}

/**
 * Prominent sign-in prompt shown only to guests, right after a completed
 * exam/diagnostic — the moment they have the most reason to want to keep
 * their result. Logs in via /auth/login?next=<current page>, so Supabase
 * redirects the user straight back here after auth.
 */
export function AuthCTA({ message }: AuthCTAProps) {
  const pathname = usePathname();
  const [user, setUser] = useState<User | null | undefined>(undefined);

  useEffect(() => {
    const supabase = createClient();
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
    });
    return () => subscription.unsubscribe();
  }, []);

  if (user === undefined || user) return null;

  const next = encodeURIComponent(pathname);

  return (
    <div className="bg-exam-accent rounded-md p-5 text-exam-accent-ink" dir="rtl">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <div className="font-bold mb-0.5 flex items-center gap-2"><Save className="w-4 h-4" aria-hidden />שמור את ההתקדמות שלך</div>
          <div className="text-sm text-exam-accent-ink/85">{message}</div>
        </div>
        <Link
          href={`/auth/login?next=${next}`}
          className="flex-shrink-0 px-5 py-2.5 bg-exam-accent-ink text-exam-accent rounded-sm font-bold text-sm hover:opacity-90 transition-opacity"
        >
          <span className="inline-flex items-center gap-1">התחברות או הרשמה<ChevronLeft className="w-4 h-4" aria-hidden /></span>
        </Link>
      </div>
    </div>
  );
}
