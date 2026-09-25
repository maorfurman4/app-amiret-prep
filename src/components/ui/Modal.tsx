'use client';

import { useEffect, useId, useRef, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';

/**
 * The one overlay pattern for the app: a full-screen dimmed backdrop with a
 * single panel centered in it. Rendered into <body> so no transformed or
 * clipped ancestor can shift or cut it. Closes on the backdrop, the close
 * button and Escape; the page behind stops scrolling while it's open.
 *
 *   header  — title (+ optional actions beside the close button)
 *   body    — scrolls on its own when the content is taller than the panel
 *   footer  — optional, pinned to the bottom of the panel
 */
export function Modal({
  open,
  onClose,
  title,
  icon,
  actions,
  footer,
  children,
}: {
  open: boolean;
  onClose: () => void;
  title: ReactNode;
  icon?: ReactNode;
  actions?: ReactNode;
  footer?: ReactNode;
  children: ReactNode;
}) {
  const titleId = useId();
  const closeRef = useRef<HTMLButtonElement>(null);
  // Callers pass inline arrows; reading the latest one through a ref keeps the
  // effect below from re-running (and stealing focus) on every render.
  const onCloseRef = useRef(onClose);
  useEffect(() => { onCloseRef.current = onClose; });

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onCloseRef.current(); };
    const previousFocus = document.activeElement as HTMLElement | null;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    document.addEventListener('keydown', onKey);
    closeRef.current?.focus();
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener('keydown', onKey);
      previousFocus?.focus?.();
    };
  }, [open]);

  if (!open || typeof document === 'undefined') return null;

  return createPortal(
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4" dir="rtl">
      <div className="absolute inset-0 bg-black/55 backdrop-blur-[2px] animate-backdrop-in" onClick={onClose} aria-hidden />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="relative w-full max-w-md max-h-[85dvh] flex flex-col bg-exam-surface border border-exam-border rounded-2xl shadow-overlay animate-modal-in"
      >
        <div className="flex items-center justify-between gap-3 px-5 py-4 border-b border-exam-border">
          <h2 id={titleId} className="flex items-center gap-2 min-w-0 font-bold text-exam-ink text-lg">
            {icon}
            <span className="truncate">{title}</span>
          </h2>
          <div className="flex items-center gap-2 flex-shrink-0">
            {actions}
            <button
              ref={closeRef}
              type="button"
              onClick={onClose}
              aria-label="סגירה"
              className="hit-44 p-1.5 rounded-xl text-exam-ink-soft hover:text-exam-ink hover:bg-exam-paper-alt transition-colors"
            >
              <X className="w-5 h-5" aria-hidden />
            </button>
          </div>
        </div>
        <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain">{children}</div>
        {footer && <div className="px-5 py-4 border-t border-exam-border">{footer}</div>}
      </div>
    </div>,
    document.body,
  );
}
