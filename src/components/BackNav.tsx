'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import type { MouseEvent } from 'react';
import { ArrowRight, Home, Target, PenLine, RotateCcw, BarChart3, BookOpen } from 'lucide-react';
import { UserMenu } from '@/components/UserMenu';
import { ThemeToggle } from '@/components/ThemeToggle';

interface BackNavProps {
  backHref?: string;
  backLabel?: string;
  title?: string;
}

const QUICK_LINKS = [
  { href: '/exam',         label: 'מבחן',       icon: Target },
  { href: '/practice',     label: 'תרגול',      icon: PenLine },
  { href: '/review-queue', label: 'חזרה',       icon: RotateCcw },
  { href: '/stats',        label: 'סטטיסטיקה',  icon: BarChart3 },
  { href: '/vocabulary',   label: 'מילון',      icon: BookOpen },
];

export function BackNav({ backHref = '/', backLabel = 'דף הבית', title }: BackNavProps) {
  const pathname = usePathname();

  return (
    <nav
      className="sticky top-0 z-30 bg-exam-surface border-b border-exam-border"
      dir="rtl"
    >
      {/* Top row: back + title */}
      <div className="flex items-center gap-3 px-4 py-2.5">
        <Link
          href={backHref}
          className="hit-44 flex items-center gap-1.5 text-exam-accent hover:opacity-80 text-sm font-medium transition-opacity flex-shrink-0"
        >
          <ArrowRight className="w-4 h-4" aria-hidden />
          <span>{backLabel}</span>
        </Link>

        {title && (
          <>
            <span className="text-exam-border select-none">/</span>
            <span className="text-sm font-bold text-exam-ink truncate">{title}</span>
          </>
        )}

        {/* Left side (RTL): home shortcut on desktop + user + theme, one tidy group */}
        <div className="mr-auto flex items-center gap-2 flex-shrink-0">
          <Link
            href="/"
            className="hidden md:flex items-center gap-1 text-xs text-exam-ink-soft hover:text-exam-ink transition-colors"
          >
            <Home className="w-3.5 h-3.5" aria-hidden />
            בית
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
              className={`flex items-center gap-1.5 px-3 py-1 rounded-sm text-xs font-medium transition-colors flex-shrink-0 border ${
                active
                  ? 'bg-exam-accent/10 border-exam-accent/30 text-exam-accent'
                  : 'border-transparent text-exam-ink-soft hover:bg-exam-paper-alt hover:text-exam-ink'
              }`}
            >
              <link.icon className="w-3.5 h-3.5" strokeWidth={1.75} aria-hidden />
              <span>{link.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
