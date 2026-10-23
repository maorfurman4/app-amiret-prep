'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useId, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Menu, X } from 'lucide-react';
import { BrandLogo } from '@/components/BrandLogo';
import { NAV_ITEMS, SECONDARY_NAV_ITEMS, isNavActive, shouldHideNav, useNavClick, type NavItem } from '@/lib/nav';

const FOCUSABLE = 'a[href], button:not([disabled])';

/**
 * Desktop (md+) navigation: a menu button fixed in the top-right corner of
 * every page opens a drawer from the right with the same primary items as
 * the mobile bottom bar (src/lib/nav.ts), plus the secondary ones desktop has
 * room for. The drawer is a modal dialog: focus moves in and is trapped,
 * Escape / the scrim / ✕ close it, and focus returns to the button.
 */
export function DesktopNav() {
  const pathname = usePathname();
  // A new route remounts it: the drawer closes once a link has navigated.
  return <DesktopNavContent key={pathname} pathname={pathname} />;
}

function DesktopNavContent({ pathname }: { pathname: string }) {
  const [open, setOpen] = useState(false);
  const { pendingHref, onNavClick } = useNavClick(pathname);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const titleId = useId();

  useEffect(() => {
    if (!open) return;
    const close = () => { setOpen(false); triggerRef.current?.focus(); };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { close(); return; }
      if (e.key !== 'Tab' || !panelRef.current) return;
      const nodes = [...panelRef.current.querySelectorAll<HTMLElement>(FOCUSABLE)];
      const first = nodes[0];
      const last = nodes[nodes.length - 1];
      const inside = panelRef.current.contains(document.activeElement);
      if (e.shiftKey && (document.activeElement === first || !inside)) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && (document.activeElement === last || !inside)) { e.preventDefault(); first.focus(); }
    };
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    document.addEventListener('keydown', onKey);
    // Start on the current page's item, else the first one.
    (panelRef.current?.querySelector<HTMLElement>('[aria-current="page"]') ?? panelRef.current?.querySelector<HTMLElement>('nav a'))?.focus();
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  if (shouldHideNav(pathname)) return null;

  const close = () => { setOpen(false); triggerRef.current?.focus(); };

  const item = ({ href, label, icon: Icon }: NavItem) => {
    const active = isNavActive(href, pathname);
    const pending = pendingHref === href;
    return (
      <li key={href}>
        <Link
          href={href}
          onClick={onNavClick(href)}
          aria-current={active ? 'page' : undefined}
          className={`flex items-center gap-3 rounded-xl border px-3 py-2.5 text-[15px] transition-colors ${
            active
              ? 'bg-exam-accent/10 border-exam-accent/30 text-exam-accent font-bold'
              : 'border-transparent text-exam-ink font-semibold hover:bg-exam-paper-alt'
          }`}
        >
          <Icon className={`w-5 h-5 flex-shrink-0 ${active ? '' : 'text-exam-ink-soft'}`} strokeWidth={active ? 2.25 : 1.75} aria-hidden />
          <span className="flex-1">{label}</span>
          {pending && <span className="text-xs font-bold text-exam-alt">לחץ שוב לצאת</span>}
        </Link>
      </li>
    );
  };

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setOpen(true)}
        aria-label="פתיחת תפריט ניווט"
        aria-haspopup="dialog"
        aria-expanded={open}
        className="hidden md:grid fixed top-2.5 right-4 z-40 size-10 place-items-center rounded-xl border border-exam-border bg-exam-surface text-exam-ink shadow-surface hover:bg-exam-paper-alt transition-colors"
      >
        <Menu className="w-5 h-5" aria-hidden />
      </button>

      {open && createPortal(
        <div className="fixed inset-0 z-[60]" dir="rtl" data-nav-drawer>
          <div className="absolute inset-0 bg-black/55 backdrop-blur-[2px] animate-backdrop-in touch-manipulation" onClick={close} aria-hidden data-nav-scrim />
          <div
            ref={panelRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby={titleId}
            className="absolute inset-y-0 right-0 flex w-[300px] max-w-[85vw] flex-col rounded-s-2xl border-s border-exam-border bg-exam-surface shadow-overlay animate-in slide-in-from-right duration-300 ease-spring-soft motion-reduce:animate-none"
          >
            <div className="flex items-center justify-between gap-3 px-4 py-3 border-b border-exam-border">
              <h2 id={titleId}>
                <BrandLogo className="w-[72px] h-auto" />
                <span className="sr-only">תפריט ניווט</span>
              </h2>
              <button
                type="button"
                onClick={close}
                aria-label="סגירת התפריט"
                className="hit-44 p-1.5 rounded-xl text-exam-ink-soft hover:text-exam-ink hover:bg-exam-paper-alt transition-colors"
              >
                <X className="w-5 h-5" aria-hidden />
              </button>
            </div>

            <nav aria-label="ניווט ראשי" className="flex-1 overflow-y-auto overscroll-contain p-3">
              <p role="status" className="sr-only">{pendingHref ? 'באמצע תרגול. לחץ שוב כדי לצאת' : ''}</p>
              <ul className="space-y-1">{NAV_ITEMS.map(item)}</ul>
              <h3 className="mt-5 mb-1.5 px-3 text-xs font-bold text-exam-ink-soft">עוד</h3>
              <ul className="space-y-1">{SECONDARY_NAV_ITEMS.map(item)}</ul>
            </nav>
          </div>
        </div>,
        document.body,
      )}
    </>
  );
}
