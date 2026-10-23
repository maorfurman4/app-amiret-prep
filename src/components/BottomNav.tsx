'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { NAV_ITEMS, isNavActive, shouldHideNav, useNavClick } from '@/lib/nav';

export function BottomNav() {
  const pathname = usePathname();
  return <BottomNavContent key={pathname} pathname={pathname} />;
}

function BottomNavContent({ pathname }: { pathname: string }) {
  const { pendingHref, onNavClick } = useNavClick(pathname);

  if (shouldHideNav(pathname)) return null;

  return (
    <nav
      aria-label="ניווט ראשי"
      // pb-2.5: lifts the tabs ~2.5mm off the screen's bottom edge. A fixed
      // value, since the viewport doesn't use viewport-fit=cover, so
      // env(safe-area-inset-bottom) is always 0 here.
      className="fixed bottom-0 inset-x-0 z-40 bg-exam-surface border-t border-exam-border pb-2.5 md:hidden transform-gpu"
      dir="rtl"
      style={{ WebkitTransform: 'translateZ(0)' }}
    >
      {/* The first tap mid-activity only swaps a label; say why nothing happened. */}
      <p role="status" className="sr-only">{pendingHref ? 'באמצע תרגול. לחץ שוב כדי לצאת' : ''}</p>
      <div className="flex">
        {NAV_ITEMS.map(tab => {
          const active = isNavActive(tab.href, pathname);
          const isPending = pendingHref === tab.href;
          const Icon = tab.icon;

          return (
            <Link
              key={tab.href}
              href={tab.href}
              onClick={onNavClick(tab.href)}
              aria-current={active ? 'page' : undefined}
              className={`relative flex-1 flex flex-col items-center pt-2.5 pb-2 gap-1 transition-colors ${
                active
                  ? 'text-exam-accent'
                  : 'text-exam-ink-soft active:text-exam-ink'
              }`}
            >
              {active && (
                <span className="absolute top-0 inset-x-1 h-0.5 bg-exam-accent rounded-b-full" />
              )}
              {isPending ? (
                <span className="text-[10px] font-bold text-exam-alt leading-none whitespace-nowrap">לחץ שוב לצאת</span>
              ) : (
                <Icon className="w-6 h-6" strokeWidth={active ? 2.25 : 1.75} aria-hidden />
              )}
              <span className={`text-[11px] leading-tight text-center ${active ? 'font-bold' : 'font-medium'} ${isPending ? 'text-exam-alt' : ''}`}>
                {tab.label}
              </span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
