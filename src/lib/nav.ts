import { useEffect, useRef, useState, type MouseEvent } from 'react';
import { Home, Target, PenLine, BookOpen, BarChart3, RotateCcw, Brain, type LucideIcon } from 'lucide-react';
import { useActivityGuard } from '@/lib/activity-guard';

export type NavItem = { href: string; label: string; icon: LucideIcon };

/**
 * The one list of primary destinations: the mobile bottom bar and the desktop
 * drawer both render exactly this, so their items and labels can't drift.
 * Five, thumb-friendly on a phone.
 */
export const NAV_ITEMS: readonly NavItem[] = [
  { href: '/',           label: 'בית',        icon: Home      },
  { href: '/exam',       label: 'מבחן',       icon: Target    },
  { href: '/practice',   label: 'תרגול',      icon: PenLine   },
  { href: '/vocabulary', label: 'אוצר מילים', icon: BookOpen  },
  { href: '/stats',      label: 'סטטיסטיקה',  icon: BarChart3 },
];

/** Desktop has room for these too; on a phone they're reached from the home page. */
export const SECONDARY_NAV_ITEMS: readonly NavItem[] = [
  { href: '/review-queue', label: 'חזרה חכמה', icon: RotateCcw },
  { href: '/strategies',   label: 'אסטרטגיות', icon: Brain     },
];

export function isNavActive(href: string, pathname: string): boolean {
  return href === '/' ? pathname === '/' : pathname === href || pathname.startsWith(href + '/');
}

/** No nav during an active exam or review session, or in the sign-in flow (it has its own exits). */
export function shouldHideNav(pathname: string): boolean {
  if (/^\/exam\/[^/]+/.test(pathname)) return true;
  if (/^\/review\/[^/]+/.test(pathname)) return true;
  if (pathname === '/auth' || pathname.startsWith('/auth/')) return true;
  return false;
}

const CONFIRM_WINDOW_MS = 2500;

/**
 * Click handling shared by both navs. Mid-activity (answering a practice
 * question, mid vocab deck) the FIRST click on any item — including the one
 * you're on, which would otherwise reload and wipe progress — only asks for
 * confirmation (`pendingHref`); a second click within the window goes through.
 * Clicking the item you're already on is a no-op for Next's router, so any
 * in-page state would just sit there: it hard-reloads to that item's home.
 */
export function useNavClick(pathname: string) {
  const { inProgress } = useActivityGuard();
  const [pendingHref, setPendingHref] = useState<string | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => () => {
    if (timer.current) clearTimeout(timer.current);
  }, []);

  const onNavClick = (href: string) => (e: MouseEvent<HTMLAnchorElement>) => {
    if (inProgress && pendingHref !== href) {
      e.preventDefault();
      setPendingHref(href);
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(() => setPendingHref(null), CONFIRM_WINDOW_MS);
      return;
    }
    if (pathname === href) {
      e.preventDefault();
      window.location.href = href;
    }
  };

  return { pendingHref, onNavClick };
}
