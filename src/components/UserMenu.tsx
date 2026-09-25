'use client';

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { createClient } from '@/lib/supabase';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import type { User } from '@supabase/supabase-js';
import { authFetch } from '@/lib/auth-fetch';
import { clearGuestIdentity } from '@/lib/guest';
import { BarChart3, ImageIcon, PenLine, Lock, Settings, LogOut, ChevronLeft, ArrowRight, X } from 'lucide-react';

type Panel = 'menu' | 'settings' | 'name' | 'password' | 'avatar';

const MENU_WIDTH = 288;
const VIEWPORT_GUTTER = 8;

/* Fixed-palette classes (menu-* tokens are identical in light and dark). */
const ITEM = 'flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-right text-sm font-semibold text-menu-ink hover:bg-menu-hover focus-visible:bg-menu-hover focus-visible:outline-none transition-colors';
const ITEM_ICON = 'w-[18px] h-[18px] flex-shrink-0 text-menu-accent';
const INPUT = 'w-full px-3 py-2 rounded-lg border border-menu-border bg-menu-surface text-sm text-menu-ink placeholder:text-menu-ink-soft focus:outline-none focus:ring-2 focus:ring-menu-accent/30';
const PRIMARY = 'w-full py-2.5 rounded-xl bg-menu-accent text-white text-sm font-bold shadow-raised hover:-translate-y-0.5 active:translate-y-0 active:shadow-pressed transition-[transform,box-shadow,opacity] duration-300 ease-spring disabled:opacity-50';

/** `previewUser` is for the dev-only /dev/user-menu preview: it skips the auth subscription. */
export function UserMenu({ previewUser }: { previewUser?: User } = {}) {
  const supabase = createClient();
  const router = useRouter();
  const [user, setUser] = useState<User | null>(previewUser ?? null);
  const [open, setOpen] = useState(false);
  const [panel, setPanel] = useState<Panel>('menu');
  const menuRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const [position, setPosition] = useState<{ top: number; left: number; width: number } | null>(null);

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
    if (previewUser) return;
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

  const close = useCallback((restoreFocus = false) => {
    setOpen(false);
    setPanel('menu');
    if (restoreFocus) triggerRef.current?.focus();
  }, []);

  // The menu is portaled to <body> with fixed positioning: rendered in place,
  // it was trapped in whatever stacking context its header created (e.g. the
  // home page's animated top bar), so later page content could paint over it
  // regardless of z-index. Anchor it under the avatar, clamped to the viewport.
  const place = useCallback(() => {
    const r = triggerRef.current?.getBoundingClientRect();
    if (!r) return;
    const width = Math.min(MENU_WIDTH, window.innerWidth - VIEWPORT_GUTTER * 2);
    const left = Math.min(Math.max(VIEWPORT_GUTTER, r.left), window.innerWidth - width - VIEWPORT_GUTTER);
    setPosition({ top: r.bottom + 10, left, width });
  }, []);

  useLayoutEffect(() => {
    if (!open) return;
    place();
    window.addEventListener('resize', place);
    window.addEventListener('scroll', place, true);
    return () => {
      window.removeEventListener('resize', place);
      window.removeEventListener('scroll', place, true);
    };
  }, [open, place]);

  // Close on outside click (the panel lives outside menuRef, in the portal)
  // and on Escape.
  useEffect(() => {
    if (!open) return;
    function handleClick(e: MouseEvent) {
      const t = e.target as Node;
      if (menuRef.current?.contains(t) || panelRef.current?.contains(t)) return;
      close();
    }
    function handleKey(e: KeyboardEvent) {
      if (e.key === 'Escape') close(true);
    }
    document.addEventListener('mousedown', handleClick);
    document.addEventListener('keydown', handleKey);
    return () => {
      document.removeEventListener('mousedown', handleClick);
      document.removeEventListener('keydown', handleKey);
    };
  }, [open, close]);

  // Move focus into the menu when it opens or changes panel, for keyboard users.
  useEffect(() => {
    if (open && position) panelRef.current?.querySelector<HTMLElement>('[data-autofocus]')?.focus();
  }, [open, position, panel]);

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
      if (!res.ok) { setNameError(data.error ?? 'לא הצלחנו לשמור. נסה שוב.'); return; }
      setDisplayName(data.displayName);
      setPanel('settings');
    } catch {
      setNameError('אין חיבור לאינטרנט.');
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
      setTimeout(() => { setPwSuccess(false); setPanel('settings'); }, 1500);
    } catch {
      setPwError('אין חיבור לאינטרנט.');
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
      if (!res.ok) { setAvatarError(data.error ?? 'לא הצלחנו להעלות את התמונה.'); return; }
      setAvatarOverride(data.avatarUrl);
    } catch {
      setAvatarError('אין חיבור לאינטרנט.');
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
      if (!res.ok) { setAvatarError(data.error ?? 'לא הצלחנו להסיר את התמונה.'); return; }
      setAvatarOverride(null);
    } catch {
      setAvatarError('אין חיבור לאינטרנט.');
    } finally {
      setAvatarSaving(false);
    }
  };

  if (!user) {
    return (
      <Link
        href="/auth/login"
        className="hit-44 text-sm font-medium text-exam-ink-soft hover:text-exam-ink px-3 py-1.5 rounded-sm hover:bg-exam-paper-alt transition-colors"
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

  const avatar = (size: 'sm' | 'lg') => {
    // The trigger follows the page theme; inside the always-white menu the
    // avatar uses the fixed menu palette.
    const cls = size === 'sm'
      ? 'w-8 h-8 text-sm bg-exam-accent text-exam-accent-ink'
      : 'w-12 h-12 text-lg bg-menu-accent text-white';
    return avatarUrl ? (
      // eslint-disable-next-line @next/next/no-img-element
      <img src={avatarUrl} alt="" className={`${cls} rounded-full object-cover`} referrerPolicy="no-referrer" />
    ) : (
      <div className={`${cls} rounded-full flex items-center justify-center font-bold select-none`} aria-hidden>
        {initial}
      </div>
    );
  };

  const subHeader = (title: string, back: Panel) => (
    <div className="flex items-center gap-2 px-2 pb-2 mb-1 border-b border-menu-border">
      <button
        data-autofocus
        onClick={() => setPanel(back)}
        className="w-8 h-8 rounded-full flex items-center justify-center text-menu-ink-soft hover:bg-menu-hover hover:text-menu-ink transition-colors"
        aria-label="חזרה"
      >
        <ArrowRight className="w-4 h-4" aria-hidden />
      </button>
      <span className="text-sm font-bold text-menu-ink flex-1">{title}</span>
      <button
        onClick={() => close(true)}
        className="w-8 h-8 rounded-full flex items-center justify-center text-menu-ink-soft hover:bg-menu-hover hover:text-menu-ink transition-colors"
        aria-label="סגירה"
      >
        <X className="w-4 h-4" aria-hidden />
      </button>
    </div>
  );

  const sheet = open && position && createPortal(
    <div
      ref={panelRef}
      id="user-menu"
      role="menu"
      aria-label="תפריט משתמש"
      dir="rtl"
      style={{ top: position.top, left: position.left, width: position.width }}
      className="fixed z-[1000] origin-top-left rounded-2xl border border-menu-border bg-menu-surface p-2 text-menu-ink shadow-raised ring-1 ring-black/5 animate-in fade-in-0 zoom-in-95 slide-in-from-top-1 duration-200 ease-spring-soft"
    >
      {panel === 'menu' && (
        <>
          {/* Profile picture + name */}
          <div className="flex items-center gap-3 px-2 pt-1 pb-3 mb-1 border-b border-menu-border">
            {avatar('lg')}
            <div className="min-w-0 flex-1">
              <p className="text-[15px] font-bold text-menu-ink truncate">{displayName || 'הגדר שם תצוגה'}</p>
              <p className="text-xs text-menu-ink-soft truncate" dir="ltr">{user.email}</p>
            </div>
          </div>

          <Link data-autofocus role="menuitem" href="/stats" onClick={() => close()} className={ITEM}>
            <BarChart3 className={ITEM_ICON} aria-hidden />
            <span className="flex-1">סטטיסטיקה</span>
          </Link>
          <button role="menuitem" onClick={() => setPanel('settings')} className={ITEM}>
            <Settings className={ITEM_ICON} aria-hidden />
            <span className="flex-1">הגדרות</span>
            <ChevronLeft className="w-4 h-4 text-menu-ink-soft" aria-hidden />
          </button>

          <div className="my-1.5 border-t border-menu-border" />

          <button
            role="menuitem"
            onClick={handleSignOut}
            className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-right text-sm font-bold text-menu-danger hover:bg-menu-danger-bg focus-visible:bg-menu-danger-bg focus-visible:outline-none transition-colors"
          >
            <LogOut className="w-[18px] h-[18px] flex-shrink-0" aria-hidden />
            <span className="flex-1">התנתקות</span>
          </button>
        </>
      )}

      {panel === 'settings' && (
        <>
          {subHeader('הגדרות', 'menu')}
          <button role="menuitem" onClick={() => { setAvatarError(null); setPanel('avatar'); }} className={ITEM}>
            <ImageIcon className={ITEM_ICON} aria-hidden />
            <span className="flex-1">תמונת פרופיל</span>
            <ChevronLeft className="w-4 h-4 text-menu-ink-soft" aria-hidden />
          </button>
          <button role="menuitem" onClick={() => { setNameInput(displayName); setNameError(null); setPanel('name'); }} className={ITEM}>
            <PenLine className={ITEM_ICON} aria-hidden />
            <span className="flex-1">שם תצוגה</span>
            <ChevronLeft className="w-4 h-4 text-menu-ink-soft" aria-hidden />
          </button>
          {canChangePassword && (
            <button role="menuitem" onClick={() => { setPwError(null); setPwSuccess(false); setPanel('password'); }} className={ITEM}>
              <Lock className={ITEM_ICON} aria-hidden />
              <span className="flex-1">שינוי סיסמה</span>
              <ChevronLeft className="w-4 h-4 text-menu-ink-soft" aria-hidden />
            </button>
          )}
        </>
      )}

      {panel === 'avatar' && (
        <div className="space-y-3">
          {subHeader('תמונת פרופיל', 'settings')}
          <div className="flex justify-center py-1">{avatar('lg')}</div>
          {avatarError && <p className="text-xs text-menu-danger text-center">{avatarError}</p>}
          <div className="px-1 space-y-2">
            <button onClick={handlePickAvatar} disabled={avatarSaving} className={PRIMARY}>
              {avatarSaving ? 'מעלה...' : 'בחר תמונה מהגלריה'}
            </button>
            {avatarUrl && (
              <button
                onClick={handleRemoveAvatar}
                disabled={avatarSaving}
                className="w-full py-2 rounded-xl text-sm font-semibold text-menu-danger hover:bg-menu-danger-bg transition-colors disabled:opacity-50"
              >
                הסר תמונה
              </button>
            )}
            <p className="text-[11px] text-menu-ink-soft text-center pb-1">JPG, PNG, WEBP או GIF · עד 3MB</p>
          </div>
        </div>
      )}

      {panel === 'name' && (
        <div className="space-y-2">
          {subHeader('שם תצוגה', 'settings')}
          <div className="px-1 pb-1 space-y-2">
            <input
              type="text"
              value={nameInput}
              onChange={e => setNameInput(e.target.value)}
              maxLength={40}
              placeholder="השם שיופיע בלוח המובילים"
              className={INPUT}
            />
            {nameError && <p className="text-xs text-menu-danger">{nameError}</p>}
            <button onClick={handleSaveName} disabled={nameSaving} className={PRIMARY}>
              {nameSaving ? 'שומר...' : 'שמור'}
            </button>
          </div>
        </div>
      )}

      {panel === 'password' && (
        <div className="space-y-2">
          {subHeader('שינוי סיסמה', 'settings')}
          <div className="px-1 pb-1 space-y-2">
            {pwSuccess ? (
              <p className="text-sm text-[#14563E] font-semibold py-2">הסיסמה עודכנה בהצלחה</p>
            ) : (
              <>
                <input
                  type="password"
                  value={newPassword}
                  onChange={e => setNewPassword(e.target.value)}
                  placeholder="סיסמה חדשה"
                  autoComplete="new-password"
                  className={INPUT}
                />
                <input
                  type="password"
                  value={confirmPassword}
                  onChange={e => setConfirmPassword(e.target.value)}
                  placeholder="אימות סיסמה"
                  autoComplete="new-password"
                  className={INPUT}
                />
                {pwError && <p className="text-xs text-menu-danger">{pwError}</p>}
                <button onClick={handleChangePassword} disabled={pwSaving} className={PRIMARY}>
                  {pwSaving ? 'מעדכן...' : 'עדכן סיסמה'}
                </button>
              </>
            )}
          </div>
        </div>
      )}
    </div>,
    document.body,
  );

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
        ref={triggerRef}
        onClick={() => (open ? close() : (setPanel('menu'), setOpen(true)))}
        className={`hit-44 flex items-center rounded-full transition-[box-shadow,transform] duration-300 ease-spring hover:scale-105 active:scale-95 focus:outline-none focus-visible:ring-2 focus-visible:ring-exam-accent/50 ${open ? 'ring-2 ring-exam-accent/60' : ''}`}
        aria-label="תפריט משתמש"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={open ? 'user-menu' : undefined}
      >
        {avatar('sm')}
      </button>
      {sheet}
    </div>
  );
}
