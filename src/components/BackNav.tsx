'use client';

import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import { UserMenu } from '@/components/UserMenu';
import { ThemeToggle } from '@/components/ThemeToggle';

interface BackNavProps {
  backHref?: string;
  backLabel?: string;
  title?: string;
}

/**
 * The contextual top row of an inner page: back link, optional title, and the
 * account menu + theme. The category nav is global (BottomNav on a phone,
 * DesktopNav's corner button on desktop), so it isn't repeated here.
 */
export function BackNav({ backHref = '/', backLabel = 'דף הבית', title }: BackNavProps) {
  return (
    <nav
      aria-label="ניווט עליון"
      className="sticky top-0 z-30 bg-exam-surface border-b border-exam-border"
      dir="rtl"
    >
      {/* md:ps-16 keeps the back link clear of DesktopNav's fixed corner button. */}
      <div className="flex items-center gap-3 px-4 md:ps-16 py-2.5">
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

        {/* Left side (RTL): user + theme */}
        <div className="mr-auto flex items-center gap-2 flex-shrink-0">
          <UserMenu />
          <ThemeToggle />
        </div>
      </div>
    </nav>
  );
}
