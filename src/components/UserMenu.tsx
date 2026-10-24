'use client';

import { useCallback, useEffect, useId, useLayoutEffect, useRef, useState, type KeyboardEvent as ReactKeyboardEvent, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { createClient } from '@/lib/supabase';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import type { User } from '@supabase/supabase-js';
import { authFetch } from '@/lib/auth-fetch';
import { clearGuestIdentity } from '@/lib/guest';
import { clearLocalLearningData } from '@/lib/local-learning-data';
import { addLocalDays, todayLocalStr } from '@/lib/date-local';
import { heCount } from '@/lib/hebrew-count';
import { DELETE_CONFIRMATION } from '@/lib/account-deletion';
import { setWordAudio, useWordAudio } from '@/lib/sound-preference';
import { Reveal } from '@/components/strategies/Reveal';
import { Modal } from '@/components/ui/Modal';
import { GoalStepper } from '@/components/GoalStepper';
import { setTheme, useIsDark } from '@/components/ThemeToggle';
import { ExamDatePicker } from '@/components/home/ExamDatePicker';
import { formatExamDate } from '@/components/home/ExamDateCard';
import {
  BarChart3, Award, CalendarClock, Target, SunMoon, Volume2, UserRound, Lock, Trash2, LifeBuoy,
  LogOut, LogIn, ChevronDown, ChevronLeft, Camera, Eye, EyeOff, Check, PenLine, Flame,
} from 'lucide-react';
import { LegalLinks } from '@/components/LegalLinks';

type Section = 'profile' | 'password';
type Goals = { examDate: string | null; dailyActivityTarget: number };

const MENU_WIDTH = 320;
const VIEWPORT_GUTTER = 8;
/** Same window PUT /api/goals enforces. */
const MAX_EXAM_DAYS_AHEAD = 730;
/** Typed into the delete dialog to arm its button. */
const DELETE_WORD = 'מחיקה';
const FOCUSABLE = 'a[href], button:not([disabled]), input:not([disabled]), [tabindex]:not([tabindex="-1"])';

/* Menu-palette classes (menu-* tokens have their own light and dark values). */
const ROW_BASE = 'flex w-full min-h-11 items-center gap-3 rounded-xl px-3 py-2 text-start text-sm font-semibold focus-visible:outline-none transition-colors';
const ROW = `${ROW_BASE} text-menu-ink hover:bg-menu-hover focus-visible:bg-menu-hover`;
const ROW_STATIC = `${ROW_BASE} text-menu-ink`;
const ROW_DANGER = `${ROW_BASE} text-menu-danger hover:bg-menu-danger-bg focus-visible:bg-menu-danger-bg`;
const ROW_ICON = 'w-[18px] h-[18px] flex-shrink-0 text-menu-accent';
const ROW_VALUE = 'max-w-[45%] truncate text-xs font-medium text-menu-ink-soft';
const GROUP_TITLE = 'px-3 pt-3 pb-1 text-xs font-bold text-menu-ink-soft';
const LABEL = 'block text-xs font-semibold text-menu-ink-soft mb-1';
const INPUT = 'w-full px-3 py-2 rounded-lg border border-menu-border-input bg-menu-surface text-sm text-start text-menu-ink placeholder:text-menu-ink-soft focus:outline-none focus:ring-2 focus:ring-menu-accent/30';
const PRIMARY = 'w-full py-2.5 rounded-xl bg-menu-accent text-menu-accent-ink text-sm font-bold shadow-raised hover:-translate-y-0.5 active:translate-y-0 active:shadow-pressed transition-[transform,box-shadow,opacity] duration-300 ease-spring aria-disabled:opacity-50';
const ERROR = 'text-xs font-semibold text-menu-danger';
const SUCCESS = 'min-h-4 text-xs font-semibold text-menu-success';
const TILE = 'flex flex-col items-start gap-2 rounded-xl border border-menu-border p-3 text-start hover:bg-menu-hover focus-visible:bg-menu-hover focus-visible:outline-none transition-colors';
/* The exam-date and delete dialogs are app Modals, so they use the page palette. */
const MODAL_PRIMARY = 'flex-1 h-11 rounded-xl font-bold shadow-raised active:scale-[0.97] disabled:opacity-50 disabled:pointer-events-none transition-[transform,box-shadow] duration-300 ease-spring';
const MODAL_SECONDARY = 'h-11 px-4 rounded-xl border border-exam-border text-exam-ink-soft hover:bg-exam-paper-alt active:scale-[0.97] disabled:opacity-50 transition-[transform,background-color] duration-300 ease-spring';

/**
 * The profile as stored in user_stats, per user. Every page mounts its own
 * UserMenu, so this lets a page change show the avatar and name at once
 * instead of waiting on the user_stats read again.
 */
type Profile = { id: string; name: string; avatar: string | null };
const profileCache = new Map<string, Profile>();

/**
 * The provider's photo, used only when there's no custom avatar. Auth
 * user_metadata can't hold the custom one: every Google sign-in resets
 * avatar_url to the Google photo, and the copy in the browser's session isn't
 * updated by an upload. A URL into our avatars bucket there is a stale custom
 * upload (possibly a removed one), so it's ignored; user_stats has the truth.
 */
function providerAvatar(user: User): string | null {
  const url = user.user_metadata?.avatar_url;
  return typeof url === 'string' && url && !url.includes('/storage/v1/object/public/avatars/') ? url : null;
}

/**
 * The account popover, anchored under the avatar: an identity header (with
 * the streak), two quick tiles, then grouped rows — learning, preferences,
 * account, info — and sign-out apart at the bottom. A guest gets a sign-in
 * call to action and only the device preferences and info.
 *
 * It's a non-modal dialog (it holds forms, so not a menu): focus is kept
 * inside while it's open, arrow keys move between rows, Escape or an outside
 * click closes it. The exam date and account deletion open app Modals.
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
  // Which field of the profile section takes focus when it opens.
  const [profileFocus, setProfileFocus] = useState<'name' | 'avatar'>('name');
  const menuRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const [position, setPosition] = useState<{ top: number; left: number; width: number } | null>(null);
  const isDark = useIsDark();
  const wordAudio = useWordAudio();

  // Fetched on every open; undefined while loading.
  const [streak, setStreak] = useState<number | undefined>(undefined);
  const [goals, setGoals] = useState<Goals | null | undefined>(undefined);

  // What this mount loaded or saved, else what an earlier page's menu cached.
  const [loaded, setLoaded] = useState<Profile | null>(null);
  const profile = user ? (loaded?.id === user.id ? loaded : profileCache.get(user.id)) : undefined;
  const displayName = profile?.name ?? '';
  // user_stats.avatar_url: undefined until it loads, null when there's no custom avatar.
  const customAvatar = profile ? profile.avatar : undefined;

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

  const [avatarSaving, setAvatarSaving] = useState(false);
  const [avatarError, setAvatarError] = useState<string | null>(null);
  const [avatarStatus, setAvatarStatus] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const avatarPickRef = useRef<HTMLButtonElement>(null);
  const [refocusPick, setRefocusPick] = useState(0);

  const [examOpen, setExamOpen] = useState(false);
  const [examDraft, setExamDraft] = useState('');
  const [examSaving, setExamSaving] = useState(false);
  const [examError, setExamError] = useState<string | null>(null);

  // The daily goal saves itself shortly after the last step (one PUT per burst of clicks).
  const [goalError, setGoalError] = useState(false);
  const goalSave = useRef<{ timer: ReturnType<typeof setTimeout>; value: number } | null>(null);
  const savedTarget = useRef<number | null>(null);

  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteWord, setDeleteWord] = useState('');
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  useEffect(() => {
    if (previewUser) return;
    // onAuthStateChange fires INITIAL_SESSION on mount with the persisted session
    // This covers both cold load and post-OAuth redirect without a separate getSession() race
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
    });
    return () => subscription.unsubscribe();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Name and avatar come from user_stats, the durable copy. Keyed on the id,
  // not the user object, which every token refresh replaces.
  const userId = user?.id;
  useEffect(() => {
    if (!user) return;
    const id = user.id;
    let live = true;
    (supabase.from('user_stats') as any).select('display_name, avatar_url').eq('user_id', id).maybeSingle() // eslint-disable-line @typescript-eslint/no-explicit-any
      .then(({ data, error }: { data: { display_name: string | null; avatar_url: string | null } | null; error: unknown }) => {
        if (!live) return;
        const next = {
          id,
          name: data?.display_name ?? (user.user_metadata?.full_name as string | undefined) ?? '',
          avatar: data?.avatar_url ?? null,
        };
        if (!error) profileCache.set(id, next);
        setLoaded(next);
      });
    return () => { live = false; };
  }, [userId]); // eslint-disable-line react-hooks/exhaustive-deps

  const saveProfile = (patch: Partial<Omit<Profile, 'id'>>) => {
    if (!user) return;
    const next = { id: user.id, name: displayName, avatar: customAvatar ?? null, ...patch };
    profileCache.set(user.id, next);
    setLoaded(next);
  };

  // The streak (accounts and guests alike) and the account's goals, fresh on
  // every open so a session finished on another page shows up. A newer load
  // supersedes an older one; a failure just leaves the value out.
  const loadRequest = useRef(0);
  const loadSummary = useCallback((signedIn: boolean) => {
    const req = ++loadRequest.current;
    setStreak(undefined);
    setGoals(signedIn ? undefined : null);
    authFetch('/api/streak')
      .then(r => (r.ok ? r.json() : Promise.reject()))
      .then((d: { streak: number }) => { if (req === loadRequest.current) setStreak(d.streak); })
      .catch(() => { if (req === loadRequest.current) setStreak(0); });
    if (!signedIn) return;
    authFetch('/api/goals')
      .then(r => (r.ok ? r.json() : Promise.reject()))
      .then((d: Goals) => { if (req === loadRequest.current) { savedTarget.current = d.dailyActivityTarget; setGoals(d); } })
      .catch(() => { if (req === loadRequest.current) setGoals(null); });
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
  // and on Escape; keep Tab cycling inside the panel while it's open, and let
  // the arrow keys step through its rows.
  useEffect(() => {
    if (!open) return;
    function handleClick(e: MouseEvent) {
      const t = e.target as Node;
      if (menuRef.current?.contains(t) || panelRef.current?.contains(t)) return;
      close();
    }
    function handleKey(e: KeyboardEvent) {
      if (e.key === 'Escape') { close(true); return; }
      const arrow = e.key === 'ArrowDown' || e.key === 'ArrowUp';
      if ((e.key !== 'Tab' && !arrow) || !panelRef.current) return;
      const active = document.activeElement as HTMLElement | null;
      // Text fields and the theme radios use the arrows themselves.
      if (arrow && (active?.tagName === 'INPUT' || active?.closest('[role="radiogroup"]'))) return;
      // Folded sections are inert, and an unchecked radio is reached with the arrows only.
      const nodes = [...panelRef.current.querySelectorAll<HTMLElement>(FOCUSABLE)].filter(n => !n.closest('[inert]') && n.tabIndex >= 0);
      if (nodes.length === 0) return;
      const at = active ? nodes.indexOf(active) : -1;
      if (arrow) {
        e.preventDefault();
        const step = e.key === 'ArrowDown' ? 1 : -1;
        nodes[at === -1 ? (step > 0 ? 0 : nodes.length - 1) : (at + step + nodes.length) % nodes.length].focus();
        return;
      }
      const first = nodes[0];
      const last = nodes[nodes.length - 1];
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
    if (section) {
      const key = section === 'profile' ? profileFocus : 'password';
      panelRef.current?.querySelector<HTMLElement>(`[data-autofocus="${key}"]`)?.focus();
    } else if (!panelRef.current?.contains(document.activeElement)) panelRef.current?.focus();
  }, [open, position, section, profileFocus]);

  // After the avatar is removed its button unmounts; keep focus in the section.
  useEffect(() => {
    if (refocusPick) avatarPickRef.current?.focus();
  }, [refocusPick]);

  const openSection = (s: Section, focus: 'name' | 'avatar' = 'name') => {
    if (s === 'profile') {
      setNameInput(displayName); setNameError(null); setNameSaved(false);
      setAvatarError(null); setAvatarStatus(null);
      setProfileFocus(focus);
    }
    if (s === 'password') { setPwError(null); setPwSuccess(false); }
    setSection(s);
  };
  const toggleSection = (s: Section) => (section === s ? setSection(null) : openSection(s));

  // The dialogs replace the menu; closing one hands focus back to the avatar.
  const openExamDialog = () => {
    const date = goals?.examDate ?? null;
    setExamDraft(date && date >= todayLocalStr() ? date : '');
    setExamError(null);
    close();
    setExamOpen(true);
  };
  const closeExamDialog = () => { setExamOpen(false); triggerRef.current?.focus(); };
  const openDeleteDialog = () => {
    setDeleteWord('');
    setDeleteError(null);
    close();
    setDeleteOpen(true);
  };
  const closeDeleteDialog = () => { if (deleting) return; setDeleteOpen(false); triggerRef.current?.focus(); };

  const handleSignOut = async () => {
    // The device's copy of this account's lists must not reach the next sign-in.
    clearLocalLearningData();
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
      saveProfile({ name: data.displayName });
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
      // The URL carries a fresh ?t= cache-buster, so the new image shows at once.
      saveProfile({ avatar: data.avatarUrl });
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
      saveProfile({ avatar: null });
      setAvatarStatus('התמונה הוסרה');
      setRefocusPick(n => n + 1);
    } catch {
      setAvatarError('אין חיבור לאינטרנט.');
    } finally {
      setAvatarSaving(false);
    }
  };

  // Same request and messages as the home ExamDateCard.
  const saveExamDate = async (value: string | null) => {
    if (examSaving) return;
    setExamSaving(true);
    setExamError(null);
    try {
      const res = await authFetch('/api/goals', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ examDate: value }),
      });
      if (!res.ok) {
        setExamError(res.status === 400 ? 'בחר תאריך מהיום ועד שנתיים קדימה' : 'השמירה נכשלה. נסה שוב');
        return;
      }
      setGoals(g => (g ? { ...g, examDate: value } : g));
      closeExamDialog();
    } catch {
      setExamError('אין חיבור. נסה שוב');
    } finally {
      setExamSaving(false);
    }
  };

  const putDailyTarget = (value: number) => {
    goalSave.current = null;
    authFetch('/api/goals', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ dailyActivityTarget: value }),
    })
      .then(res => { if (!res.ok) throw new Error(String(res.status)); savedTarget.current = value; })
      .catch(() => {
        setGoalError(true);
        // Back to what the server has, so the row never shows an unsaved value.
        const saved = savedTarget.current;
        if (saved !== null) setGoals(g => (g ? { ...g, dailyActivityTarget: saved } : g));
      });
  };

  const changeDailyTarget = (value: number) => {
    setGoalError(false);
    setGoals(g => (g ? { ...g, dailyActivityTarget: value } : g));
    if (goalSave.current) clearTimeout(goalSave.current.timer);
    goalSave.current = { value, timer: setTimeout(() => putDailyTarget(value), 500) };
  };

  // Leaving the page with a step still waiting: send it now rather than drop it.
  useEffect(() => () => {
    const pending = goalSave.current;
    if (pending) { clearTimeout(pending.timer); putDailyTarget(pending.value); }
  }, []);

  const handleDeleteAccount = async () => {
    if (deleting || deleteWord.trim() !== DELETE_WORD) return;
    setDeleting(true);
    setDeleteError(null);
    try {
      const res = await authFetch('/api/account', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ confirm: DELETE_CONFIRMATION }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) { setDeleteError(data.error ?? 'המחיקה נכשלה. נסה שוב.'); setDeleting(false); return; }
    } catch {
      setDeleteError('אין חיבור לאינטרנט.');
      setDeleting(false);
      return;
    }
    // The account is gone: drop this device's copy and its session, then go home.
    clearLocalLearningData();
    await supabase.auth.signOut({ scope: 'local' }).catch(() => {});
    await clearGuestIdentity();
    setDeleteOpen(false);
    router.push('/');
  };

  const initial = (displayName || user?.email || '?')[0].toUpperCase();
  // The custom avatar wins; the provider photo is only the default. Until
  // user_stats answers, show the initial rather than flash the provider photo.
  const avatarUrl = !user || customAvatar === undefined ? undefined : customAvatar ?? providerAvatar(user) ?? undefined;
  const hasCustomAvatar = !!customAvatar;
  const canChangePassword = user?.app_metadata?.provider === 'email';
  const sectionId = (s: Section) => `${uid}-${s}`;
  const today = todayLocalStr();
  const upcomingExam = goals?.examDate && goals.examDate >= today ? goals.examDate : null;

  const avatar = (size: 'sm' | 'lg') => {
    // The trigger follows the page palette; inside the menu the avatar uses
    // the menu palette.
    const cls = size === 'sm'
      ? 'w-8 h-8 text-sm bg-exam-accent text-exam-accent-ink'
      : 'w-14 h-14 text-xl bg-menu-accent text-menu-accent-ink';
    return avatarUrl ? (
      // eslint-disable-next-line @next/next/no-img-element
      <img src={avatarUrl} alt="" className={`${cls} rounded-full object-cover`} referrerPolicy="no-referrer" />
    ) : (
      <span className={`${cls} rounded-full flex items-center justify-center font-bold select-none`} aria-hidden>
        {initial}
      </span>
    );
  };

  const group = (key: string, title: string, children: ReactNode) => (
    <div role="group" aria-labelledby={`${uid}-group-${key}`} data-menu-group={key}>
      <h3 id={`${uid}-group-${key}`} className={GROUP_TITLE}>{title}</h3>
      {children}
    </div>
  );

  const sectionRow = (s: Section, icon: ReactNode, label: string) => (
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
      <ChevronDown className={`w-4 h-4 flex-shrink-0 text-menu-ink-soft transition-transform duration-300 ${section === s ? 'rotate-180' : ''}`} aria-hidden />
    </button>
  );

  const linkRow = (href: string, icon: ReactNode, label: string) => (
    <Link href={href} onClick={() => close()} className={ROW}>
      {icon}
      <span className="flex-1">{label}</span>
      <ChevronLeft className="w-4 h-4 flex-shrink-0 text-menu-ink-soft" aria-hidden />
    </Link>
  );

  const streakChip = () => {
    if (!streak) return null;
    return (
      <p className="mt-1.5 inline-flex items-center gap-1 rounded-full bg-exam-alt-bg px-2 py-0.5 text-xs font-bold text-exam-alt" data-streak={streak}>
        <Flame className="w-3.5 h-3.5" fill="currentColor" aria-hidden />
        רצף {heCount(streak, 'day')}
      </p>
    );
  };

  // ── Theme: the same mechanism as ThemeToggle, as a two-way segmented control.
  const themeOption = (dark: boolean, label: string) => (
    <button
      type="button"
      role="radio"
      aria-checked={isDark === dark}
      tabIndex={isDark === dark ? 0 : -1}
      onClick={() => setTheme(dark)}
      className={`min-w-12 rounded-md px-2.5 py-1 text-xs font-bold transition-[background-color,color,box-shadow] duration-200 ${isDark === dark ? 'bg-menu-surface text-menu-ink shadow-surface' : 'text-menu-ink-soft hover:text-menu-ink'}`}
    >
      {label}
    </button>
  );
  const onThemeKey = (e: ReactKeyboardEvent<HTMLDivElement>) => {
    if (!['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(e.key)) return;
    e.preventDefault();
    setTheme(!isDark);
    // The newly checked radio takes focus, as in any radio group.
    requestAnimationFrame(() => e.currentTarget?.querySelector<HTMLElement>('[aria-checked="true"]')?.focus());
  };

  const preferences = group('prefs', 'העדפות', (
    <>
      <div className={ROW_STATIC}>
        <SunMoon className={ROW_ICON} aria-hidden />
        <span id={`${uid}-theme`} className="flex-1">ערכת נושא</span>
        <div role="radiogroup" aria-labelledby={`${uid}-theme`} onKeyDown={onThemeKey} className="flex rounded-lg bg-menu-hover p-0.5">
          {themeOption(false, 'בהיר')}
          {themeOption(true, 'כהה')}
        </div>
      </div>
      <button type="button" role="switch" aria-checked={wordAudio} onClick={() => setWordAudio(!wordAudio)} className={ROW}>
        <Volume2 className={ROW_ICON} aria-hidden />
        <span className="flex-1">הגיית מילים</span>
        <span className={`relative h-6 w-10 flex-shrink-0 rounded-full transition-colors duration-200 ${wordAudio ? 'bg-menu-accent' : 'bg-menu-border-input'}`} aria-hidden>
          <span className={`absolute top-0.5 size-5 rounded-full bg-menu-surface shadow-surface transition-[inset-inline-start] duration-200 ease-spring ${wordAudio ? 'start-[1.125rem]' : 'start-0.5'}`} />
        </span>
      </button>
    </>
  ));

  const info = group('info', 'מידע', (
    <>
      {linkRow('/help', <LifeBuoy className={ROW_ICON} aria-hidden />, 'עזרה ותמיכה')}
    </>
  ));

  const guestBody = (
    <>
      <div className="rounded-xl bg-menu-hover/60 p-3 mb-1">
        <div className="flex items-center gap-3">
          <span className="w-14 h-14 flex-shrink-0 rounded-full bg-menu-surface border border-menu-border flex items-center justify-center text-menu-accent" aria-hidden>
            <UserRound className="w-7 h-7" />
          </span>
          <div className="min-w-0 flex-1">
            <h2 className="text-base font-bold text-start">גולש כאורח</h2>
            <p className="text-xs text-menu-ink-soft text-start">ההתקדמות נשמרת רק בדפדפן הזה</p>
            {streakChip()}
          </div>
        </div>
        <Link href="/auth/login" onClick={() => close()} className={`${PRIMARY} mt-3 flex items-center justify-center gap-2`} data-guest-cta>
          {/* The arrow points into the door; mirror it for RTL. */}
          <LogIn className="w-4 h-4 rtl:-scale-x-100" aria-hidden />
          התחברות / הרשמה
        </Link>
      </div>
      {preferences}
      {info}
    </>
  );

  const accountBody = user && (
    <>
      {/* Identity header */}
      <div className="flex items-center gap-3 rounded-xl bg-menu-hover/60 p-3">
        <button
          type="button"
          onClick={() => openSection('profile', 'avatar')}
          aria-label="שינוי תמונת פרופיל"
          className="relative flex-shrink-0 rounded-full focus:outline-none focus-visible:ring-2 focus-visible:ring-menu-accent/50"
        >
          {avatar('lg')}
          <span className="absolute -bottom-0.5 -end-0.5 w-6 h-6 rounded-full bg-menu-surface border border-menu-border flex items-center justify-center shadow-surface" aria-hidden>
            <Camera className="w-3.5 h-3.5 text-menu-accent" />
          </span>
        </button>
        <div className="min-w-0 flex-1">
          {displayName ? (
            <div className="flex items-center gap-1">
              <h2 dir="auto" className="text-base font-bold truncate text-start">{displayName}</h2>
              <button
                type="button"
                onClick={() => openSection('profile')}
                aria-label="עריכת שם תצוגה"
                className="hit-44 w-7 h-7 flex-shrink-0 rounded-full flex items-center justify-center text-menu-ink-soft hover:bg-menu-hover hover:text-menu-ink transition-colors"
              >
                <PenLine className="w-3.5 h-3.5" aria-hidden />
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => openSection('profile')}
              className="inline-flex items-center gap-1 text-base font-bold text-menu-accent underline decoration-dotted underline-offset-4"
            >
              <PenLine className="w-3.5 h-3.5" aria-hidden />
              הגדר שם תצוגה
            </button>
          )}
          <p className="text-xs text-menu-ink-soft truncate text-start"><bdi dir="ltr">{user.email}</bdi></p>
          {streakChip()}
        </div>
      </div>

      {/* Quick tiles */}
      <div className="mt-2 grid grid-cols-2 gap-2">
        <Link href="/stats" onClick={() => close()} className={TILE}>
          <span className="grid size-8 place-items-center rounded-lg bg-menu-accent text-menu-accent-ink"><BarChart3 className="w-4 h-4" aria-hidden /></span>
          <span className="text-sm font-bold leading-tight">הסטטיסטיקה שלי</span>
        </Link>
        <Link href="/stats#official-scores" onClick={() => close()} className={TILE}>
          <span className="grid size-8 place-items-center rounded-lg bg-menu-accent text-menu-accent-ink"><Award className="w-4 h-4" aria-hidden /></span>
          <span className="text-sm font-bold leading-tight">הציון הרשמי</span>
        </Link>
      </div>

      {group('learning', 'הלמידה שלי', (
        <>
          <button type="button" onClick={openExamDialog} aria-haspopup="dialog" className={ROW}>
            <CalendarClock className={ROW_ICON} aria-hidden />
            <span className="flex-1">תאריך המבחן</span>
            <span className={ROW_VALUE} data-value="exam-date">
              {goals === undefined ? '…' : upcomingExam ? formatExamDate(upcomingExam) : 'לא נקבע'}
            </span>
            <ChevronLeft className="w-4 h-4 flex-shrink-0 text-menu-ink-soft" aria-hidden />
          </button>
          <div className={ROW_STATIC}>
            <Target className={ROW_ICON} aria-hidden />
            <span className="flex-1">
              <span id={`${uid}-goal`}>יעד יומי</span>
              {goalError && <span role="alert" className="block text-[11px] font-semibold text-menu-danger">לא נשמר. נסה שוב</span>}
            </span>
            {goals ? (
              <>
                <GoalStepper value={goals.dailyActivityTarget} onChange={changeDailyTarget} labelledBy={`${uid}-goal`} buttonClass="border border-menu-border-input text-menu-ink hover:bg-menu-hover" />
                <span className="text-xs font-medium text-menu-ink-soft">שאלות</span>
              </>
            ) : <span className={ROW_VALUE} data-value="daily-goal">…</span>}
          </div>
        </>
      ))}

      {preferences}

      {group('account', 'החשבון', (
        <>
          {sectionRow('profile', <UserRound className={ROW_ICON} aria-hidden />, 'שם תצוגה ותמונה')}
          <Reveal open={section === 'profile'} id={sectionId('profile')}>
            <div className="px-3 pb-3 pt-1 space-y-3">
              <form className="space-y-2" onSubmit={e => { e.preventDefault(); handleSaveName(); }} noValidate>
                <label htmlFor={`${uid}-name-input`} className={LABEL}>השם שיוצג באפליקציה</label>
                <input
                  id={`${uid}-name-input`}
                  data-autofocus="name"
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
                  {nameSaving ? 'שומר...' : 'שמירת השם'}
                </button>
              </form>
              <div className="space-y-2 border-t border-menu-border pt-3">
                <p className={LABEL}>תמונת פרופיל</p>
                <button ref={avatarPickRef} type="button" data-autofocus="avatar" onClick={handlePickAvatar} aria-disabled={avatarSaving} className="w-full py-2 rounded-xl border border-menu-border-input text-sm font-bold text-menu-ink hover:bg-menu-hover transition-colors aria-disabled:opacity-50">
                  {avatarSaving ? 'מעלה...' : hasCustomAvatar ? 'החלפת תמונה' : 'בחירת תמונה'}
                </button>
                {hasCustomAvatar && (
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
                        data-autofocus="password"
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

          <button type="button" onClick={openDeleteDialog} aria-haspopup="dialog" className={ROW_DANGER}>
            <Trash2 className="w-[18px] h-[18px] flex-shrink-0" aria-hidden />
            <span className="flex-1">מחיקת חשבון</span>
          </button>
        </>
      ))}

      {info}

      <div className="mt-2 border-t border-menu-border pt-2">
        <button
          type="button"
          onClick={handleSignOut}
          className={ROW_DANGER}
        >
          <LogOut className="w-[18px] h-[18px] flex-shrink-0" aria-hidden />
          <span className="flex-1">התנתקות</span>
        </button>
      </div>
    </>
  );

  const sheet = open && position && createPortal(
    <div
      ref={panelRef}
      id="user-menu"
      data-menu-surface
      data-menu-state={user ? 'account' : 'guest'}
      role="dialog"
      aria-label={user ? 'החשבון שלי' : 'תפריט אורח'}
      tabIndex={-1}
      dir="rtl"
      style={{ top: position.top, left: position.left, width: position.width }}
      className="fixed z-[1000] max-h-[calc(100dvh-5rem)] overflow-y-auto overscroll-contain origin-top-left rounded-2xl border border-menu-border bg-menu-surface p-2 text-menu-ink shadow-raised ring-1 ring-black/5 focus:outline-none animate-in fade-in-0 zoom-in-95 slide-in-from-top-1 duration-200 ease-spring-soft"
    >
      {user ? accountBody : guestBody}
      <LegalLinks className="mt-3 pt-2 text-center text-menu-ink-soft" />
    </div>,
    document.body,
  );

  const examTitleId = `${uid}-exam-title`;
  const examFormId = `${uid}-exam-form`;

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
      {user ? (
        <button
          ref={triggerRef}
          onClick={() => (open ? close() : (setSection(null), setOpen(true), loadSummary(true)))}
          className={`hit-44 flex items-center rounded-full transition-[box-shadow,transform] duration-300 ease-spring hover:scale-105 active:scale-95 focus:outline-none focus-visible:ring-2 focus-visible:ring-exam-accent/50 ${open ? 'ring-2 ring-exam-accent/60' : ''}`}
          aria-label="החשבון שלי"
          aria-haspopup="dialog"
          aria-expanded={open}
          aria-controls={open ? 'user-menu' : undefined}
        >
          {avatar('sm')}
        </button>
      ) : (
        <button
          ref={triggerRef}
          onClick={() => (open ? close() : (setOpen(true), loadSummary(false)))}
          className={`hit-44 inline-flex items-center gap-1.5 rounded-full border border-exam-border px-3 py-1.5 text-sm font-semibold text-exam-ink hover:bg-exam-paper-alt transition-colors ${open ? 'bg-exam-paper-alt' : ''}`}
          aria-haspopup="dialog"
          aria-expanded={open}
          aria-controls={open ? 'user-menu' : undefined}
        >
          {/* The arrow points into the door; mirror it for RTL. */}
          <LogIn className="w-4 h-4 rtl:-scale-x-100" aria-hidden />
          כניסה
        </button>
      )}
      {sheet}

      <Modal
        open={examOpen}
        onClose={closeExamDialog}
        title="תאריך המבחן"
        icon={<CalendarClock className="w-5 h-5 text-exam-accent" strokeWidth={1.75} aria-hidden />}
        footer={(
          <div className="flex items-center gap-2">
            <button type="submit" form={examFormId} disabled={!examDraft || examSaving} className={`${MODAL_PRIMARY} bg-exam-accent text-exam-accent-ink`}>
              {examSaving ? 'שומר…' : 'שמור תאריך'}
            </button>
            {upcomingExam && (
              <button type="button" onClick={() => void saveExamDate(null)} disabled={examSaving} className={MODAL_SECONDARY}>
                הסרת התאריך
              </button>
            )}
          </div>
        )}
      >
        <form id={examFormId} className="p-5 space-y-3" onSubmit={e => { e.preventDefault(); if (examDraft) void saveExamDate(examDraft); }}>
          <p id={examTitleId} className="text-sm text-exam-ink-soft">החזרות יתוזמנו כך שהזיכרון יגיע לשיא ביום המבחן.</p>
          <ExamDatePicker value={examDraft} min={today} max={addLocalDays(today, MAX_EXAM_DAYS_AHEAD)} onChange={setExamDraft} labelledBy={examTitleId} />
          <p aria-live="polite" className="text-center text-[13px] text-exam-ink-soft">
            {examDraft ? formatExamDate(examDraft) : 'בחר יום בלוח'}
          </p>
          {examError && <p role="alert" className="text-xs font-semibold text-exam-wrong">{examError}</p>}
        </form>
      </Modal>

      <Modal
        open={deleteOpen}
        onClose={closeDeleteDialog}
        title="מחיקת החשבון"
        icon={<Trash2 className="w-5 h-5 text-exam-wrong" aria-hidden />}
        footer={(
          <div className="flex items-center gap-2">
            <button
              type="submit"
              form={`${uid}-delete-form`}
              disabled={deleteWord.trim() !== DELETE_WORD || deleting}
              className={`${MODAL_PRIMARY} bg-exam-wrong text-on-danger`}
            >
              {deleting ? 'מוחק…' : 'מחיקת החשבון לצמיתות'}
            </button>
            <button type="button" onClick={closeDeleteDialog} disabled={deleting} className={MODAL_SECONDARY}>ביטול</button>
          </div>
        )}
      >
        <form id={`${uid}-delete-form`} className="p-5 space-y-3 text-sm text-exam-ink" onSubmit={e => { e.preventDefault(); void handleDeleteAccount(); }}>
          <p className="font-bold">המחיקה סופית ואי אפשר לשחזר אותה. יימחקו:</p>
          <ul className="list-disc ps-5 space-y-1 text-exam-ink-soft">
            <li>המבחנים, הציונים והציונים הרשמיים שדיווחת</li>
            <li>היסטוריית התרגול, החזרות והרצף</li>
            <li>רשימות המילים שסימנת</li>
            <li>השם, התמונה ופרטי ההתחברות</li>
          </ul>
          <div>
            <label htmlFor={`${uid}-delete-word`} className="block mb-1 font-semibold">
              כדי לאשר, הקלד <b>{DELETE_WORD}</b>
            </label>
            <input
              id={`${uid}-delete-word`}
              type="text"
              dir="auto"
              autoComplete="off"
              value={deleteWord}
              onChange={e => setDeleteWord(e.target.value)}
              aria-invalid={!!deleteError}
              aria-describedby={`${uid}-delete-msg`}
              className="w-full px-3 py-2 rounded-lg border border-exam-border-strong bg-exam-surface text-exam-ink focus:outline-none focus:ring-2 focus:ring-exam-wrong/30"
            />
          </div>
          <div id={`${uid}-delete-msg`}>{deleteError && <p role="alert" className="text-xs font-semibold text-exam-wrong">{deleteError}</p>}</div>
        </form>
      </Modal>
    </div>
  );
}
