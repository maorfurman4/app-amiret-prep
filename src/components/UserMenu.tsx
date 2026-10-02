'use client';

import { useCallback, useEffect, useId, useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { createClient } from '@/lib/supabase';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import type { User } from '@supabase/supabase-js';
import { authFetch } from '@/lib/auth-fetch';
import { clearGuestIdentity } from '@/lib/guest';
import { fetchStatsRows } from '@/lib/stats-client';
import type { StatsMetrics } from '@/lib/stats-metrics';
import { Reveal } from '@/components/strategies/Reveal';
import { BarChart3, ImageIcon, PenLine, Lock, LogOut, LogIn, ChevronDown, Camera, Eye, EyeOff, Check, Award } from 'lucide-react';

type Section = 'name' | 'avatar' | 'password';

const MENU_WIDTH = 320;
const VIEWPORT_GUTTER = 8;
const FOCUSABLE = 'a[href], button:not([disabled]), input:not([disabled]), [tabindex]:not([tabindex="-1"])';

/* Fixed-palette classes (menu-* tokens are identical in light and dark). */
const ROW = 'flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-start text-sm font-semibold text-menu-ink hover:bg-menu-hover focus-visible:bg-menu-hover focus-visible:outline-none transition-colors';
const ROW_ICON = 'w-[18px] h-[18px] flex-shrink-0 text-menu-accent';
const LABEL = 'block text-xs font-semibold text-menu-ink-soft mb-1';
const INPUT = 'w-full px-3 py-2 rounded-lg border border-menu-border-input bg-menu-surface text-sm text-start text-menu-ink placeholder:text-menu-ink-soft focus:outline-none focus:ring-2 focus:ring-menu-accent/30';
const PRIMARY = 'w-full py-2.5 rounded-xl bg-menu-accent text-white text-sm font-bold shadow-raised hover:-translate-y-0.5 active:translate-y-0 active:shadow-pressed transition-[transform,box-shadow,opacity] duration-300 ease-spring aria-disabled:opacity-50';
const ERROR = 'text-xs font-semibold text-menu-danger';
const SUCCESS = 'min-h-4 text-xs font-semibold text-menu-success';

/**
 * The account popover: an identity header (avatar, name, and the same three
 * numbers /stats leads with), links, and the account settings as rows that
 * open in place. It's a non-modal dialog (it holds forms, so not a menu):
 * focus is kept inside while it's open, Escape or an outside click closes it.
 *
 * `previewUser` is for the dev-only /dev/user-menu preview: it skips the auth subscription.
 */
export function UserMenu({ previewUser }: { previewUser?: User } = {}) {
  const supabase = createClient();
  const router = useRouter();
  const uid = useId();
  const [user, setUser] = useState<User | null>(previewUser ?? null);
  const [open, setOpen] = useState(false);
  const [section, setSection] = useState<Section | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const [position, setPosition] = useState<{ top: number; left: number; width: number } | null>(null);

  // undefined while loading; null when there are no completed exams yet.
  const [metrics, setMetrics] = useState<StatsMetrics | null | undefined>(undefined);
  const [statsError, setStatsError] = useState(false);

  const [displayName, setDisplayName] = useState('');
  const [nameInput, setNameInput] = useState('');
  const [nameSaving, setNameSaving] = useState(false);
  const [nameError, setNameError] = useState<string | null>(null);
  const [nameSaved, setNameSaved] = useState(false);

  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [pwSaving, setPwSaving] = useState(false);
  const [pwError, setPwError] = useState<string | null>(null);
  const [pwSuccess, setPwSuccess] = useState(false);

  const [avatarOverride, setAvatarOverride] = useState<string | null | undefined>(undefined);
  const [avatarSaving, setAvatarSaving] = useState(false);
  const [avatarError, setAvatarError] = useState<string | null>(null);
  const [avatarStatus, setAvatarStatus] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const avatarPickRef = useRef<HTMLButtonElement>(null);
  const [refocusPick, setRefocusPick] = useState(0);

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

  // The header numbers come from the exact pipeline /stats uses (same rows,
  // same computeStatsMetrics), fetched fresh on every open so a just-finished
  // exam shows up. The metrics module is loaded on demand to keep it out of
  // every page's initial bundle. A newer load supersedes an older one.
  const statsRequest = useRef(0);
  const loadStats = useCallback(() => {
    const req = ++statsRequest.current;
    setStatsError(false);
    setMetrics(undefined);
    Promise.all([fetchStatsRows(), import('@/lib/stats-metrics')])
      .then(([rows, { computeStatsMetrics }]) => { if (req === statsRequest.current) setMetrics(computeStatsMetrics(rows)); })
      .catch(() => { if (req === statsRequest.current) setStatsError(true); });
  }, []);

  const close = useCallback((restoreFocus = false) => {
    setOpen(false);
    setSection(null);
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
  // and on Escape; keep Tab cycling inside the panel while it's open.
  useEffect(() => {
    if (!open) return;
    function handleClick(e: MouseEvent) {
      const t = e.target as Node;
      if (menuRef.current?.contains(t) || panelRef.current?.contains(t)) return;
      close();
    }
    function handleKey(e: KeyboardEvent) {
      if (e.key === 'Escape') { close(true); return; }
      if (e.key !== 'Tab' || !panelRef.current) return;
      // Folded sections are inert, so skip anything inside them.
      const nodes = [...panelRef.current.querySelectorAll<HTMLElement>(FOCUSABLE)].filter(n => !n.closest('[inert]'));
      if (nodes.length === 0) return;
      const first = nodes[0];
      const last = nodes[nodes.length - 1];
      const active = document.activeElement;
      if (!panelRef.current.contains(active) || active === panelRef.current) {
        e.preventDefault();
        (e.shiftKey ? last : first).focus();
      } else if (e.shiftKey && active === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && active === last) {
        e.preventDefault();
        first.focus();
      }
    }
    document.addEventListener('mousedown', handleClick);
    document.addEventListener('keydown', handleKey);
    return () => {
      document.removeEventListener('mousedown', handleClick);
      document.removeEventListener('keydown', handleKey);
    };
  }, [open, close]);

  // On open, focus the dialog itself so screen readers announce it by name;
  // when a section opens, move focus to its first field.
  useEffect(() => {
    if (!open || !position) return;
    if (section) panelRef.current?.querySelector<HTMLElement>(`#${CSS.escape(`${uid}-${section}`)} [data-autofocus]`)?.focus();
    else if (!panelRef.current?.contains(document.activeElement)) panelRef.current?.focus();
  }, [open, position, section, uid]);

  // After the avatar is removed its button unmounts; keep focus in the section.
  useEffect(() => {
    if (refocusPick) avatarPickRef.current?.focus();
  }, [refocusPick]);

  const openSection = (s: Section) => {
    if (s === 'name') { setNameInput(displayName); setNameError(null); setNameSaved(false); }
    if (s === 'avatar') { setAvatarError(null); setAvatarStatus(null); }
    if (s === 'password') { setPwError(null); setPwSuccess(false); }
    setSection(s);
  };
  const toggleSection = (s: Section) => (section === s ? setSection(null) : openSection(s));

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    await clearGuestIdentity();
    router.push('/auth/login');
  };

  const handleSaveName = async () => {
    if (nameSaving) return;
    const trimmed = nameInput.trim();
    setNameSaved(false);
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
      setNameInput(data.displayName);
      setNameSaved(true);
    } catch {
      setNameError('אין חיבור לאינטרנט.');
    } finally {
      setNameSaving(false);
    }
  };

  const handleChangePassword = async () => {
    if (pwSaving) return;
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
      setShowPassword(false);
      setTimeout(() => {
        setPwSuccess(false);
        setSection(s => (s === 'password' ? null : s));
        // The folded form goes inert; hand focus back to its row.
        document.getElementById(`${uid}-password-row`)?.focus();
      }, 1500);
    } catch {
      setPwError('אין חיבור לאינטרנט.');
    } finally {
      setPwSaving(false);
    }
  };

  const handlePickAvatar = () => { if (!avatarSaving) fileInputRef.current?.click(); };

  const handleAvatarSelected = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = ''; // allow re-selecting the same file later
    if (!file) return;

    setAvatarError(null);
    setAvatarStatus(null);
    setAvatarSaving(true);
    try {
      const body = new FormData();
      body.append('file', file);
      const res = await authFetch('/api/profile/upload-avatar', { method: 'POST', body });
      const data = await res.json();
      if (!res.ok) { setAvatarError(data.error ?? 'לא הצלחנו להעלות את התמונה.'); return; }
      setAvatarOverride(data.avatarUrl);
      setAvatarStatus('התמונה עודכנה');
    } catch {
      setAvatarError('אין חיבור לאינטרנט.');
    } finally {
      setAvatarSaving(false);
    }
  };

  const handleRemoveAvatar = async () => {
    if (avatarSaving) return;
    setAvatarError(null);
    setAvatarStatus(null);
    setAvatarSaving(true);
    try {
      const res = await authFetch('/api/profile/upload-avatar', { method: 'DELETE' });
      const data = await res.json();
      if (!res.ok) { setAvatarError(data.error ?? 'לא הצלחנו להסיר את התמונה.'); return; }
      setAvatarOverride(null);
      setAvatarStatus('התמונה הוסרה');
      setRefocusPick(n => n + 1);
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
        className="hit-44 inline-flex items-center gap-1.5 rounded-full border border-exam-border px-3 py-1.5 text-sm font-semibold text-exam-ink hover:bg-exam-paper-alt transition-colors"
      >
        {/* The arrow points into the door; mirror it for RTL. */}
        <LogIn className="w-4 h-4 rtl:-scale-x-100" aria-hidden />
        כניסה
      </Link>
    );
  }

  const initial = (displayName || user.email || '?')[0].toUpperCase();
  const avatarUrl = avatarOverride !== undefined
    ? avatarOverride ?? undefined
    : (user.user_metadata?.avatar_url as string | undefined);
  const canChangePassword = user.app_metadata?.provider === 'email';
  const sectionId = (s: Section) => `${uid}-${s}`;

  const avatar = (size: 'sm' | 'lg') => {
    // The trigger follows the page theme; inside the always-white menu the
    // avatar uses the fixed menu palette.
    const cls = size === 'sm'
      ? 'w-8 h-8 text-sm bg-exam-accent text-exam-accent-ink'
      : 'w-14 h-14 text-xl bg-menu-accent text-white';
    return avatarUrl ? (
      // eslint-disable-next-line @next/next/no-img-element
      <img src={avatarUrl} alt="" className={`${cls} rounded-full object-cover`} referrerPolicy="no-referrer" />
    ) : (
      <span className={`${cls} rounded-full flex items-center justify-center font-bold select-none`} aria-hidden>
        {initial}
      </span>
    );
  };

  const sectionRow = (s: Section, icon: ReactNode, label: string, value?: string) => (
    <button
      type="button"
      id={`${sectionId(s)}-row`}
      onClick={() => toggleSection(s)}
      aria-expanded={section === s}
      aria-controls={sectionId(s)}
      className={ROW}
    >
      {icon}
      <span className="flex-1">{label}</span>
      {value && <bdi className="max-w-[40%] truncate text-xs font-medium text-menu-ink-soft">{value}</bdi>}
      <ChevronDown className={`w-4 h-4 flex-shrink-0 text-menu-ink-soft transition-transform duration-300 ${section === s ? 'rotate-180' : ''}`} aria-hidden />
    </button>
  );

  const statsStrip = () => {
    if (statsError) {
      return (
        <p className="mt-3 text-xs text-menu-ink-soft">
          לא הצלחנו לטעון את הנתונים.{' '}
          <button type="button" onClick={loadStats} className="font-bold text-menu-accent underline underline-offset-2">לנסות שוב</button>
        </p>
      );
    }
    if (metrics === undefined) {
      return (
        <div className="mt-3 grid grid-cols-3 gap-1.5" aria-busy="true">
          <span className="sr-only">טוען נתונים</span>
          {[0, 1, 2].map(i => <div key={i} className="h-[52px] rounded-lg bg-menu-surface/70 animate-pulse" aria-hidden />)}
        </div>
      );
    }
    if (metrics === null) {
      return (
        <p className="mt-3 text-xs text-menu-ink-soft">
          עוד לא השלמת מבחן מלא.{' '}
          <Link href="/exam" onClick={() => close()} className="font-bold text-menu-accent underline underline-offset-2">למבחן הראשון</Link>
        </p>
      );
    }
    // Same three numbers, labels and order as the /stats summary strip.
    return (
      <dl className="mt-3 grid grid-cols-3 gap-1.5 text-center">
        {[
          { label: 'מבחנים', value: metrics.examCount, metric: 'exam-count' },
          { label: 'הציון הגבוה', value: metrics.bestScore, metric: 'best-score' },
          { label: 'המבחן האחרון', value: metrics.lastScore, metric: 'last-score' },
        ].map(f => (
          <div key={f.metric} className="rounded-lg bg-menu-surface px-1 py-2 flex flex-col-reverse">
            <dt className="text-[11px] text-menu-ink-soft">{f.label}</dt>
            <dd className="text-base font-bold tabular-nums" data-metric={f.metric}>{f.value}</dd>
          </div>
        ))}
      </dl>
    );
  };

  const sheet = open && position && createPortal(
    <div
      ref={panelRef}
      id="user-menu"
      data-menu-surface
      role="dialog"
      aria-labelledby={`${uid}-title`}
      tabIndex={-1}
      dir="rtl"
      style={{ top: position.top, left: position.left, width: position.width }}
      className="fixed z-[1000] max-h-[calc(100dvh-5rem)] overflow-y-auto overscroll-contain origin-top-left rounded-2xl border border-menu-border bg-menu-surface p-2 text-menu-ink shadow-raised ring-1 ring-black/5 focus:outline-none animate-in fade-in-0 zoom-in-95 slide-in-from-top-1 duration-200 ease-spring-soft"
    >
      {/* Identity header */}
      <div className="rounded-xl bg-menu-hover/60 p-3 mb-1">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => openSection('avatar')}
            aria-label="שינוי תמונת פרופיל"
            className="relative flex-shrink-0 rounded-full focus:outline-none focus-visible:ring-2 focus-visible:ring-menu-accent/50"
          >
            {avatar('lg')}
            <span className="absolute -bottom-0.5 -end-0.5 w-6 h-6 rounded-full bg-menu-surface border border-menu-border flex items-center justify-center shadow-surface" aria-hidden>
              <Camera className="w-3.5 h-3.5 text-menu-accent" />
            </span>
          </button>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1">
              <h2 id={`${uid}-title`} dir="auto" className="text-base font-bold truncate text-start">{displayName || 'הוספת שם תצוגה'}</h2>
              <button
                type="button"
                onClick={() => openSection('name')}
                aria-label="עריכת שם תצוגה"
                className="hit-44 w-7 h-7 flex-shrink-0 rounded-full flex items-center justify-center text-menu-ink-soft hover:bg-menu-hover hover:text-menu-ink transition-colors"
              >
                <PenLine className="w-3.5 h-3.5" aria-hidden />
              </button>
            </div>
            <p className="text-xs text-menu-ink-soft truncate text-start"><bdi dir="ltr">{user.email}</bdi></p>
          </div>
        </div>
        {statsStrip()}
      </div>

      <Link href="/stats" onClick={() => close()} className={ROW}>
        <BarChart3 className={ROW_ICON} aria-hidden />
        <span className="flex-1">סטטיסטיקה</span>
      </Link>
      <Link href="/stats#official-scores" onClick={() => close()} className={ROW}>
        <Award className={ROW_ICON} aria-hidden />
        <span className="flex-1">הציון הרשמי שלי</span>
      </Link>

      <div className="my-1.5 border-t border-menu-border" />
      <h3 className="px-3 pt-1 pb-0.5 text-[11px] font-bold text-menu-ink-soft">חשבון</h3>

      {sectionRow('name', <PenLine className={ROW_ICON} aria-hidden />, 'שם תצוגה', displayName)}
      <Reveal open={section === 'name'} id={sectionId('name')}>
        <form className="px-3 pb-3 pt-1 space-y-2" onSubmit={e => { e.preventDefault(); handleSaveName(); }} noValidate>
          <label htmlFor={`${uid}-name-input`} className={LABEL}>השם שיוצג באפליקציה</label>
          <input
            id={`${uid}-name-input`}
            data-autofocus
            type="text"
            dir="auto"
            value={nameInput}
            onChange={e => { setNameInput(e.target.value); setNameSaved(false); }}
            maxLength={40}
            placeholder="השם שלך"
            aria-invalid={!!nameError}
            aria-describedby={`${uid}-name-msg`}
            className={INPUT}
          />
          <div id={`${uid}-name-msg`}>
            {nameError && <p role="alert" className={ERROR}>{nameError}</p>}
            <p aria-live="polite" className={SUCCESS}>
              {nameSaved && <span className="inline-flex items-center gap-1"><Check className="w-3.5 h-3.5" aria-hidden />נשמר</span>}
            </p>
          </div>
          <button type="submit" aria-disabled={nameSaving} className={PRIMARY}>
            {nameSaving ? 'שומר...' : 'שמירה'}
          </button>
        </form>
      </Reveal>

      {sectionRow('avatar', <ImageIcon className={ROW_ICON} aria-hidden />, 'תמונת פרופיל')}
      <Reveal open={section === 'avatar'} id={sectionId('avatar')}>
        <div className="px-3 pb-3 pt-1 space-y-2">
          <button ref={avatarPickRef} type="button" data-autofocus onClick={handlePickAvatar} aria-disabled={avatarSaving} className={PRIMARY}>
            {avatarSaving ? 'מעלה...' : avatarUrl ? 'החלפת תמונה' : 'בחירת תמונה'}
          </button>
          {avatarUrl && (
            <button
              type="button"
              onClick={handleRemoveAvatar}
              aria-disabled={avatarSaving}
              className="w-full py-2 rounded-xl text-sm font-semibold text-menu-danger hover:bg-menu-danger-bg transition-colors aria-disabled:opacity-50"
            >
              הסרת התמונה
            </button>
          )}
          {avatarError && <p role="alert" className={`${ERROR} text-center`}>{avatarError}</p>}
          <p aria-live="polite" className={`${SUCCESS} text-center`}>
            {avatarStatus && <span className="inline-flex items-center gap-1"><Check className="w-3.5 h-3.5" aria-hidden />{avatarStatus}</span>}
          </p>
          <p className="text-[11px] text-menu-ink-soft text-center">
            קובץ <bdi dir="ltr">JPG · PNG · WEBP · GIF</bdi>, עד <bdi dir="ltr">3MB</bdi>
          </p>
        </div>
      </Reveal>

      {canChangePassword && (
        <>
          {sectionRow('password', <Lock className={ROW_ICON} aria-hidden />, 'שינוי סיסמה')}
          <Reveal open={section === 'password'} id={sectionId('password')}>
            <form className="px-3 pb-3 pt-1 space-y-2" onSubmit={e => { e.preventDefault(); handleChangePassword(); }} noValidate>
              <div>
                <label htmlFor={`${uid}-pw`} className={LABEL}>סיסמה חדשה</label>
                <div className="relative">
                  {/* The field is dir=ltr inside an rtl row: the toggle sits at the
                      row's end (left), which is the field's start, hence ps-10. */}
                  <input
                    id={`${uid}-pw`}
                    data-autofocus
                    type={showPassword ? 'text' : 'password'}
                    dir="ltr"
                    value={newPassword}
                    onChange={e => setNewPassword(e.target.value)}
                    autoComplete="new-password"
                    aria-invalid={!!pwError}
                    aria-describedby={`${uid}-pw-hint ${uid}-pw-msg`}
                    className={`${INPUT} ps-10`}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(v => !v)}
                    aria-label={showPassword ? 'הסתרת הסיסמה' : 'הצגת הסיסמה'}
                    aria-pressed={showPassword}
                    className="absolute inset-y-0 end-0 w-10 flex items-center justify-center rounded-lg text-menu-ink-soft hover:text-menu-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-menu-accent/30"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" aria-hidden /> : <Eye className="w-4 h-4" aria-hidden />}
                  </button>
                </div>
                <p id={`${uid}-pw-hint`} className="mt-1 text-[11px] text-menu-ink-soft">לפחות <bdi>6</bdi> תווים</p>
              </div>
              <div>
                <label htmlFor={`${uid}-pw2`} className={LABEL}>אימות הסיסמה</label>
                <input
                  id={`${uid}-pw2`}
                  type={showPassword ? 'text' : 'password'}
                  dir="ltr"
                  value={confirmPassword}
                  onChange={e => setConfirmPassword(e.target.value)}
                  autoComplete="new-password"
                  aria-invalid={!!pwError}
                  aria-describedby={`${uid}-pw-msg`}
                  className={INPUT}
                />
              </div>
              <div id={`${uid}-pw-msg`}>
                {pwError && <p role="alert" className={ERROR}>{pwError}</p>}
                <p aria-live="polite" className={SUCCESS}>
                  {pwSuccess && <span className="inline-flex items-center gap-1"><Check className="w-3.5 h-3.5" aria-hidden />הסיסמה עודכנה</span>}
                </p>
              </div>
              <button type="submit" aria-disabled={pwSaving} className={PRIMARY}>
                {pwSaving ? 'מעדכן...' : 'עדכון הסיסמה'}
              </button>
            </form>
          </Reveal>
        </>
      )}

      <div className="my-1.5 border-t border-menu-border" />
      <button
        type="button"
        onClick={handleSignOut}
        className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-start text-sm font-bold text-menu-danger hover:bg-menu-danger-bg focus-visible:bg-menu-danger-bg focus-visible:outline-none transition-colors"
      >
        <LogOut className="w-[18px] h-[18px] flex-shrink-0" aria-hidden />
        <span className="flex-1">התנתקות</span>
      </button>
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
        tabIndex={-1}
        aria-hidden
        onChange={handleAvatarSelected}
      />
      <button
        ref={triggerRef}
        onClick={() => (open ? close() : (setSection(null), setOpen(true), loadStats()))}
        className={`hit-44 flex items-center rounded-full transition-[box-shadow,transform] duration-300 ease-spring hover:scale-105 active:scale-95 focus:outline-none focus-visible:ring-2 focus-visible:ring-exam-accent/50 ${open ? 'ring-2 ring-exam-accent/60' : ''}`}
        aria-label="החשבון שלי"
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-controls={open ? 'user-menu' : undefined}
      >
        {avatar('sm')}
      </button>
      {sheet}
    </div>
  );
}
