'use client';

import { useEffect, useRef, useState } from 'react';
import { createClient } from '@/lib/supabase';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import type { User } from '@supabase/supabase-js';
import { authFetch } from '@/lib/auth-fetch';
import { clearGuestIdentity } from '@/lib/guest';
import { BarChart3, ImageIcon, PenLine, Lock } from 'lucide-react';

type Panel = 'menu' | 'name' | 'password' | 'avatar';

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

  const [avatarOverride, setAvatarOverride] = useState<string | null | undefined>(undefined);
  const [avatarSaving, setAvatarSaving] = useState(false);
  const [avatarError, setAvatarError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

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
    await clearGuestIdentity();
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

  const handlePickAvatar = () => fileInputRef.current?.click();

  const handleAvatarSelected = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = ''; // allow re-selecting the same file later
    if (!file) return;

    setAvatarError(null);
    setAvatarSaving(true);
    try {
      const body = new FormData();
      body.append('file', file);
      const res = await authFetch('/api/profile/upload-avatar', { method: 'POST', body });
      const data = await res.json();
      if (!res.ok) { setAvatarError(data.error ?? 'שגיאה בהעלאה'); return; }
      setAvatarOverride(data.avatarUrl);
    } catch {
      setAvatarError('שגיאת רשת');
    } finally {
      setAvatarSaving(false);
    }
  };

  const handleRemoveAvatar = async () => {
    setAvatarError(null);
    setAvatarSaving(true);
    try {
      const res = await authFetch('/api/profile/upload-avatar', { method: 'DELETE' });
      const data = await res.json();
      if (!res.ok) { setAvatarError(data.error ?? 'שגיאה במחיקה'); return; }
      setAvatarOverride(null);
    } catch {
      setAvatarError('שגיאת רשת');
    } finally {
      setAvatarSaving(false);
    }
  };

  if (!user) {
    return (
      <Link
        href="/auth/login"
        className="text-sm font-medium text-exam-ink-soft hover:text-exam-ink px-3 py-1.5 rounded-sm hover:bg-exam-paper-alt transition-colors"
      >
        כניסה
      </Link>
    );
  }

  const initial = (displayName || user.email || '?')[0].toUpperCase();
  const avatarUrl = avatarOverride !== undefined
    ? avatarOverride ?? undefined
    : (user.user_metadata?.avatar_url as string | undefined);
  const canChangePassword = user.app_metadata?.provider === 'email';

  return (
    <div className="relative" ref={menuRef}>
      <input
        ref={fileInputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/gif"
        className="hidden"
        onChange={handleAvatarSelected}
      />
      <button
        onClick={() => { setOpen(!open); setPanel('menu'); }}
        className="flex items-center gap-2 rounded-full focus:outline-none focus:ring-2 focus:ring-exam-accent/40"
        aria-label="תפריט משתמש"
      >
        {avatarUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={avatarUrl} alt={initial} className="w-8 h-8 rounded-full object-cover" referrerPolicy="no-referrer" />
        ) : (
          <div className="w-8 h-8 rounded-full bg-exam-accent text-exam-accent-ink flex items-center justify-center text-sm font-bold select-none">
            {initial}
          </div>
        )}
      </button>

      {open && (
        <div className="absolute left-0 mt-2 w-64 bg-exam-surface border border-exam-border rounded-md py-1 z-50" dir="rtl" style={{ left: 0, right: 'auto' }}>
          {panel === 'menu' && (
            <>
              <div className="px-3 py-2 border-b border-exam-border">
                <p className="text-sm font-semibold text-exam-ink truncate">{displayName || 'הגדר שם תצוגה'}</p>
                <p className="text-xs text-exam-ink-soft truncate">{user.email}</p>
              </div>
              <Link
                href="/stats"
                onClick={() => setOpen(false)}
                className="block w-full text-right px-3 py-2 text-sm text-exam-ink hover:bg-exam-paper-alt transition-colors"
              >
                <span className="inline-flex items-center gap-2"><BarChart3 className="w-4 h-4" aria-hidden />הסטטיסטיקה שלי</span>
              </Link>
              <button
                onClick={() => { setAvatarError(null); setPanel('avatar'); }}
                className="w-full text-right px-3 py-2 text-sm text-exam-ink hover:bg-exam-paper-alt transition-colors"
              >
                <span className="inline-flex items-center gap-2"><ImageIcon className="w-4 h-4" aria-hidden />תמונת פרופיל</span>
              </button>
              <button
                onClick={() => { setNameInput(displayName); setNameError(null); setPanel('name'); }}
                className="w-full text-right px-3 py-2 text-sm text-exam-ink hover:bg-exam-paper-alt transition-colors"
              >
                <span className="inline-flex items-center gap-2"><PenLine className="w-4 h-4" aria-hidden />ערוך שם תצוגה</span>
              </button>
              {canChangePassword && (
                <button
                  onClick={() => { setPwError(null); setPwSuccess(false); setPanel('password'); }}
                  className="w-full text-right px-3 py-2 text-sm text-exam-ink hover:bg-exam-paper-alt transition-colors"
                >
                  <span className="inline-flex items-center gap-2"><Lock className="w-4 h-4" aria-hidden />שנה סיסמה</span>
                </button>
              )}
              <button
                onClick={handleSignOut}
                className="w-full text-right px-3 py-2 text-sm text-exam-wrong hover:bg-exam-paper-alt transition-colors border-t border-exam-border mt-1"
              >
                יציאה
              </button>
            </>
          )}

          {panel === 'avatar' && (
            <div className="px-3 py-3 space-y-3">
              <div className="flex items-center justify-between mb-1">
                <span className="text-sm font-bold text-exam-ink">תמונת פרופיל</span>
                <button onClick={() => setPanel('menu')} className="text-exam-ink-soft hover:text-exam-ink text-lg leading-none">×</button>
              </div>
              <div className="flex items-center justify-center">
                {avatarUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={avatarUrl} alt={initial} className="w-16 h-16 rounded-full object-cover" referrerPolicy="no-referrer" />
                ) : (
                  <div className="w-16 h-16 rounded-full bg-exam-accent text-exam-accent-ink flex items-center justify-center text-2xl font-bold select-none">
                    {initial}
                  </div>
                )}
              </div>
              {avatarError && <p className="text-xs text-exam-wrong text-center">{avatarError}</p>}
              <button
                onClick={handlePickAvatar}
                disabled={avatarSaving}
                className="w-full py-2 bg-exam-accent text-exam-accent-ink rounded-sm text-sm font-semibold hover:opacity-90 transition-opacity disabled:opacity-50"
              >
                {avatarSaving ? 'מעלה...' : 'בחר תמונה מהגלריה'}
              </button>
              {avatarUrl && (
                <button
                  onClick={handleRemoveAvatar}
                  disabled={avatarSaving}
                  className="w-full py-2 text-exam-wrong rounded-sm text-sm font-medium hover:bg-exam-wrong-bg transition-colors disabled:opacity-50"
                >
                  הסר תמונה
                </button>
              )}
              <p className="text-[11px] text-exam-ink-soft text-center">JPG, PNG, WEBP או GIF · עד 3MB</p>
            </div>
          )}

          {panel === 'name' && (
            <div className="px-3 py-3 space-y-2">
              <div className="flex items-center justify-between mb-1">
                <span className="text-sm font-bold text-exam-ink">שם תצוגה</span>
                <button onClick={() => setPanel('menu')} className="text-exam-ink-soft hover:text-exam-ink text-lg leading-none">×</button>
              </div>
              <input
                type="text"
                value={nameInput}
                onChange={e => setNameInput(e.target.value)}
                maxLength={40}
                placeholder="איך שיוצג בלוח המובילים"
                className="w-full px-3 py-2 rounded-sm border border-exam-border bg-exam-surface text-sm text-exam-ink"
              />
              {nameError && <p className="text-xs text-exam-wrong">{nameError}</p>}
              <button
                onClick={handleSaveName}
                disabled={nameSaving}
                className="w-full py-2 bg-exam-accent text-exam-accent-ink rounded-sm text-sm font-semibold hover:opacity-90 transition-opacity disabled:opacity-50"
              >
                {nameSaving ? 'שומר...' : 'שמור'}
              </button>
            </div>
          )}

          {panel === 'password' && (
            <div className="px-3 py-3 space-y-2">
              <div className="flex items-center justify-between mb-1">
                <span className="text-sm font-bold text-exam-ink">שינוי סיסמה</span>
                <button onClick={() => setPanel('menu')} className="text-exam-ink-soft hover:text-exam-ink text-lg leading-none">×</button>
              </div>
              {pwSuccess ? (
                <p className="text-sm text-exam-sage-strong font-medium py-2">הסיסמה עודכנה בהצלחה</p>
              ) : (
                <>
                  <input
                    type="password"
                    value={newPassword}
                    onChange={e => setNewPassword(e.target.value)}
                    placeholder="סיסמה חדשה"
                    autoComplete="new-password"
                    className="w-full px-3 py-2 rounded-sm border border-exam-border bg-exam-surface text-sm text-exam-ink"
                  />
                  <input
                    type="password"
                    value={confirmPassword}
                    onChange={e => setConfirmPassword(e.target.value)}
                    placeholder="אימות סיסמה"
                    autoComplete="new-password"
                    className="w-full px-3 py-2 rounded-sm border border-exam-border bg-exam-surface text-sm text-exam-ink"
                  />
                  {pwError && <p className="text-xs text-exam-wrong">{pwError}</p>}
                  <button
                    onClick={handleChangePassword}
                    disabled={pwSaving}
                    className="w-full py-2 bg-exam-accent text-exam-accent-ink rounded-sm text-sm font-semibold hover:opacity-90 transition-opacity disabled:opacity-50"
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
