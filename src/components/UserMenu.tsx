'use client';

import { useEffect, useRef, useState } from 'react';
import { createClient } from '@/lib/supabase';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import type { User } from '@supabase/supabase-js';
import { authFetch } from '@/lib/auth-fetch';

type Panel = 'menu' | 'name' | 'password';

export function UserMenu() {
  const supabase = createClient();
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [open, setOpen] = useState(false);
  const [panel, setPanel] = useState<Panel>('menu');
  const menuRef = useRef<HTMLDivElement>(null);

  const [displayName, setDisplayName] = useState('');
  const [nameInput, setNameInput] = useState('');
  const [nameSaving, setNameSaving] = useState(false);
  const [nameError, setNameError] = useState<string | null>(null);

  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [pwSaving, setPwSaving] = useState(false);
  const [pwError, setPwError] = useState<string | null>(null);
  const [pwSuccess, setPwSuccess] = useState(false);

  useEffect(() => {
    // onAuthStateChange fires INITIAL_SESSION on mount with the persisted session
    // This covers both cold load and post-OAuth redirect without a separate getSession() race
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
    });
    return () => subscription.unsubscribe();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!user) return;
    (supabase.from('user_stats') as any).select('display_name').eq('user_id', user.id).maybeSingle() // eslint-disable-line @typescript-eslint/no-explicit-any
      .then(({ data }: { data: { display_name: string | null } | null }) => {
        const name = (data?.display_name as string | null) ?? (user.user_metadata?.full_name as string | undefined) ?? '';
        setDisplayName(name);
        setNameInput(name);
      });
  }, [user]); // eslint-disable-line react-hooks/exhaustive-deps

  // Close dropdown on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setOpen(false);
        setPanel('menu');
      }
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    router.push('/auth/login');
  };

  const handleSaveName = async () => {
    const trimmed = nameInput.trim();
    if (!trimmed) { setNameError('שם תצוגה לא יכול להיות ריק'); return; }
    setNameSaving(true);
    setNameError(null);
    try {
      const res = await authFetch('/api/profile/update-name', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ displayName: trimmed }),
      });
      const data = await res.json();
      if (!res.ok) { setNameError(data.error ?? 'שגיאה בשמירה'); return; }
      setDisplayName(data.displayName);
      setPanel('menu');
    } catch {
      setNameError('שגיאת רשת');
    } finally {
      setNameSaving(false);
    }
  };

  const handleChangePassword = async () => {
    setPwError(null);
    if (newPassword.length < 6) { setPwError('הסיסמה חייבת להכיל לפחות 6 תווים'); return; }
    if (newPassword !== confirmPassword) { setPwError('הסיסמאות לא תואמות'); return; }
    setPwSaving(true);
    try {
      const { error } = await supabase.auth.updateUser({ password: newPassword });
      if (error) { setPwError(error.message); return; }
      setPwSuccess(true);
      setNewPassword('');
      setConfirmPassword('');
      setTimeout(() => { setPwSuccess(false); setPanel('menu'); }, 1500);
    } catch {
      setPwError('שגיאת רשת');
    } finally {
      setPwSaving(false);
    }
  };

  if (!user) {
    return (
      <Link
        href="/auth/login"
        className="text-sm font-medium text-slate-600 hover:text-slate-900 dark:text-slate-300 dark:hover:text-white px-3 py-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
      >
        כניסה
      </Link>
    );
  }

  const initial = (displayName || user.email || '?')[0].toUpperCase();
  const avatarUrl = user.user_metadata?.avatar_url as string | undefined;
  const canChangePassword = user.app_metadata?.provider === 'email';

  return (
    <div className="relative" ref={menuRef}>
      <button
        onClick={() => { setOpen(!open); setPanel('menu'); }}
        className="flex items-center gap-2 rounded-full focus:outline-none focus:ring-2 focus:ring-blue-400"
        aria-label="תפריט משתמש"
      >
        {avatarUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={avatarUrl} alt={initial} className="w-8 h-8 rounded-full object-cover" referrerPolicy="no-referrer" />
        ) : (
          <div className="w-8 h-8 rounded-full bg-blue-600 text-white flex items-center justify-center text-sm font-bold select-none">
            {initial}
          </div>
        )}
      </button>

      {open && (
        <div className="absolute left-0 mt-2 w-64 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl shadow-lg py-1 z-50" dir="rtl" style={{ left: 0, right: 'auto' }}>
          {panel === 'menu' && (
            <>
              <div className="px-3 py-2 border-b border-slate-100 dark:border-slate-700">
                <p className="text-sm font-semibold text-slate-800 dark:text-slate-100 truncate">{displayName || 'הגדר שם תצוגה'}</p>
                <p className="text-xs text-slate-500 dark:text-slate-400 truncate">{user.email}</p>
              </div>
              <Link
                href="/stats"
                onClick={() => setOpen(false)}
                className="block w-full text-right px-3 py-2 text-sm text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors"
              >
                📊 הסטטיסטיקה שלי
              </Link>
              <button
                onClick={() => { setNameInput(displayName); setNameError(null); setPanel('name'); }}
                className="w-full text-right px-3 py-2 text-sm text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors"
              >
                ✏️ ערוך שם תצוגה
              </button>
              {canChangePassword && (
                <button
                  onClick={() => { setPwError(null); setPwSuccess(false); setPanel('password'); }}
                  className="w-full text-right px-3 py-2 text-sm text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors"
                >
                  🔒 שנה סיסמה
                </button>
              )}
              <button
                onClick={handleSignOut}
                className="w-full text-right px-3 py-2 text-sm text-red-600 dark:text-red-400 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors border-t border-slate-100 dark:border-slate-700 mt-1"
              >
                יציאה
              </button>
            </>
          )}

          {panel === 'name' && (
            <div className="px-3 py-3 space-y-2">
              <div className="flex items-center justify-between mb-1">
                <span className="text-sm font-bold text-slate-800 dark:text-slate-100">שם תצוגה</span>
                <button onClick={() => setPanel('menu')} className="text-slate-400 hover:text-slate-600 text-lg leading-none">×</button>
              </div>
              <input
                type="text"
                value={nameInput}
                onChange={e => setNameInput(e.target.value)}
                maxLength={40}
                placeholder="איך שיוצג בלוח המובילים"
                className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-sm text-slate-900 dark:text-white"
              />
              {nameError && <p className="text-xs text-red-500">{nameError}</p>}
              <button
                onClick={handleSaveName}
                disabled={nameSaving}
                className="w-full py-2 bg-blue-600 text-white rounded-lg text-sm font-semibold hover:bg-blue-700 transition-colors disabled:opacity-50"
              >
                {nameSaving ? 'שומר...' : 'שמור'}
              </button>
            </div>
          )}

          {panel === 'password' && (
            <div className="px-3 py-3 space-y-2">
              <div className="flex items-center justify-between mb-1">
                <span className="text-sm font-bold text-slate-800 dark:text-slate-100">שינוי סיסמה</span>
                <button onClick={() => setPanel('menu')} className="text-slate-400 hover:text-slate-600 text-lg leading-none">×</button>
              </div>
              {pwSuccess ? (
                <p className="text-sm text-green-600 font-medium py-2">הסיסמה עודכנה בהצלחה ✓</p>
              ) : (
                <>
                  <input
                    type="password"
                    value={newPassword}
                    onChange={e => setNewPassword(e.target.value)}
                    placeholder="סיסמה חדשה"
                    autoComplete="new-password"
                    className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-sm text-slate-900 dark:text-white"
                  />
                  <input
                    type="password"
                    value={confirmPassword}
                    onChange={e => setConfirmPassword(e.target.value)}
                    placeholder="אימות סיסמה"
                    autoComplete="new-password"
                    className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-sm text-slate-900 dark:text-white"
                  />
                  {pwError && <p className="text-xs text-red-500">{pwError}</p>}
                  <button
                    onClick={handleChangePassword}
                    disabled={pwSaving}
                    className="w-full py-2 bg-blue-600 text-white rounded-lg text-sm font-semibold hover:bg-blue-700 transition-colors disabled:opacity-50"
                  >
                    {pwSaving ? 'מעדכן...' : 'עדכן סיסמה'}
                  </button>
                </>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
