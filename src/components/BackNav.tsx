'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import type { MouseEvent } from 'react';
import { UserMenu } from '@/components/UserMenu';
import { ThemeToggle } from '@/components/ThemeToggle';

interface BackNavProps {
  backHref?: string;
  backLabel?: string;
  title?: string;
}

const QUICK_LINKS = [
  { href: '/exam',         label: 'מבחן',       icon: '🎯' },
  { href: '/practice',     label: 'תרגול',      icon: '✏️' },
  { href: '/review-queue', label: 'חזרה',       icon: '🔄' },
  { href: '/stats',        label: 'סטטיסטיקה',  icon: '📊' },
  { href: '/vocabulary',   label: 'מילון',      icon: '📖' },
];

export function BackNav({ backHref = '/', backLabel = 'דף הבית', title }: BackNavProps) {
  const pathname = usePathname();

  return (
    <nav
      className="sticky top-0 z-30 bg-white dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 shadow-sm"
      dir="rtl"
    >
      {/* Top row: back + title */}
      <div className="flex items-center gap-3 px-4 py-2.5">
        <Link
          href={backHref}
          className="flex items-center gap-1.5 text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 text-sm font-medium transition-colors flex-shrink-0"
        >
          <span className="text-base leading-none">←</span>
          <span>{backLabel}</span>
        </Link>

        {title && (
          <>
            <span className="text-slate-300 dark:text-slate-600 select-none">/</span>
            <span className="text-sm font-bold text-slate-900 dark:text-white truncate">{title}</span>
          </>
        )}

        {/* Left side (RTL): home shortcut on desktop + user + theme, one tidy group */}
        <div className="mr-auto flex items-center gap-2 flex-shrink-0">
          <Link
            href="/"
            className="hidden md:block text-xs text-slate-400 dark:text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 transition-colors"
          >
            🏠 בית
          </Link>
          <UserMenu />
          <ThemeToggle />
        </div>
      </div>

      {/* Quick-link strip — hidden on mobile (BottomNav handles it), visible on desktop */}
      <div className="hidden md:flex items-center gap-1 px-4 pb-2 overflow-x-auto">
        {QUICK_LINKS.map(link => {
          const active = pathname === link.href || pathname.startsWith(link.href + '/');
          const handleClick = (e: MouseEvent<HTMLAnchorElement>) => {
            if (pathname === link.href) {
              e.preventDefault();
              window.location.href = link.href;
            }
          };
          return (
            <Link
              key={link.href}
              href={link.href}
              onClick={handleClick}
              className={`flex items-center gap-1 px-3 py-1 rounded-full text-xs font-medium transition-colors flex-shrink-0 ${
                active
                  ? 'bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-400'
                  : 'text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700 hover:text-slate-800 dark:hover:text-slate-200'
              }`}
            >
              <span>{link.icon}</span>
              <span>{link.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
