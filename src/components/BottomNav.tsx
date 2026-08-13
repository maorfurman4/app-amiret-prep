'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useRef, useState, type MouseEvent } from 'react';
import { useActivityGuard } from '@/lib/activity-guard';

// 5 tabs max — thumb-friendly on narrow screens.
// חזרה חכמה, אסטרטגיות, טיפים ולוח מובילים נגישים מדף הבית.
const TABS = [
  { href: '/',            icon: '🏠', label: 'בית'       },
  { href: '/exam',        icon: '🎯', label: 'מבחן'      },
  { href: '/practice',    icon: '✏️', label: 'תרגול'    },
  { href: '/vocabulary',  icon: '📖', label: 'מילים'     },
  { href: '/stats',       icon: '📊', label: 'סטטיסטיקה' },
];

const CONFIRM_WINDOW_MS = 2500;

// Hide during active exam/review sessions
function shouldHide(pathname: string): boolean {
  // /exam/[sessionId] — active exam
  if (/^\/exam\/[^/]+/.test(pathname)) return true;
  // /review/[sessionId] — reviewing past session
  if (/^\/review\/[^/]+/.test(pathname)) return true;
  return false;
}

export function BottomNav() {
  const pathname = usePathname();
  const { inProgress } = useActivityGuard();
  const [pendingHref, setPendingHref] = useState<string | null>(null);
  const pendingTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Leaving the page (route actually changed) clears any pending confirm
  useEffect(() => {
    setPendingHref(null);
    if (pendingTimerRef.current) clearTimeout(pendingTimerRef.current);
  }, [pathname]);

  if (shouldHide(pathname)) return null;

  return (
    <nav
      className="fixed bottom-0 inset-x-0 z-40 bg-white dark:bg-slate-800 border-t border-slate-200 dark:border-slate-700 md:hidden transform-gpu"
      dir="rtl"
      style={{ paddingBottom: 'env(safe-area-inset-bottom)', WebkitTransform: 'translateZ(0)' }}
    >
      <div className="flex">
        {TABS.map(tab => {
          const active =
            tab.href === '/'
              ? pathname === '/'
              : pathname === tab.href || pathname.startsWith(tab.href + '/');
          const isPending = pendingHref === tab.href;

          const handleClick = (e: MouseEvent<HTMLAnchorElement>) => {
            // Clicking the tab you're already on is a no-op for Next's router
            // (same URL → no navigation event → no remount), so any in-page
            // state — practice's picked type, vocabulary's mode — just sits
            // there. Force a hard reload back to that tab's home screen instead.
            if (pathname === tab.href) {
              e.preventDefault();
              window.location.href = tab.href;
              return;
            }
            // Mid-activity (e.g. answering a practice question): the first
            // tap on a DIFFERENT tab just asks for confirmation instead of
            // silently discarding progress. Second tap within the window
            // goes through as a normal navigation.
            if (inProgress && !isPending) {
              e.preventDefault();
              setPendingHref(tab.href);
              if (pendingTimerRef.current) clearTimeout(pendingTimerRef.current);
              pendingTimerRef.current = setTimeout(() => setPendingHref(null), CONFIRM_WINDOW_MS);
            }
          };

          return (
            <Link
              key={tab.href}
              href={tab.href}
              onClick={handleClick}
              className={`relative flex-1 flex flex-col items-center pt-2.5 pb-2 gap-1 transition-colors ${
                active
                  ? 'text-blue-600 dark:text-blue-400'
                  : 'text-slate-500 dark:text-slate-400 active:text-slate-900 dark:active:text-white'
              }`}
            >
              {active && (
                <span className="absolute top-0 inset-x-1 h-0.5 bg-blue-600 dark:bg-blue-400 rounded-b-full" />
              )}
              {isPending ? (
                <span className="text-[10px] font-bold text-orange-500 leading-none whitespace-nowrap">לחץ שוב לצאת</span>
              ) : (
                <span className="text-2xl leading-none">{tab.icon}</span>
              )}
              <span className={`text-[11px] leading-tight ${active ? 'font-bold' : 'font-medium'} ${isPending ? 'text-orange-500' : ''}`}>
                {tab.label}
              </span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
