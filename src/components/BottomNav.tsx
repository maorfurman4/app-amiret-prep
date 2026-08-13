'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import type { MouseEvent } from 'react';

// 5 tabs max — thumb-friendly on narrow screens.
// חזרה חכמה, אסטרטגיות, טיפים ולוח מובילים נגישים מדף הבית.
const TABS = [
  { href: '/',            icon: '🏠', label: 'בית'       },
  { href: '/exam',        icon: '🎯', label: 'מבחן'      },
  { href: '/practice',    icon: '✏️', label: 'תרגול'    },
  { href: '/vocabulary',  icon: '📖', label: 'מילים'     },
  { href: '/stats',       icon: '📊', label: 'סטטיסטיקה' },
];

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
          // Clicking the tab you're already on is a no-op for Next's router
          // (same URL → no navigation event → no remount), so any in-page
          // state — practice's picked type, vocabulary's mode — just sits
          // there. Force a hard reload back to that tab's home screen instead.
          const handleClick = (e: MouseEvent<HTMLAnchorElement>) => {
            if (pathname === tab.href) {
              e.preventDefault();
              window.location.href = tab.href;
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
              <span className="text-2xl leading-none">{tab.icon}</span>
              <span className={`text-[11px] leading-tight ${active ? 'font-bold' : 'font-medium'}`}>
                {tab.label}
              </span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
