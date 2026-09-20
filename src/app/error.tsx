'use client';

import { useEffect } from 'react';
import Link from 'next/link';
import { AlertTriangle, RotateCcw, Home } from 'lucide-react';

/**
 * Catches any render/runtime error thrown by a page or component below the
 * root layout (BottomNav etc. keep rendering around it). Without this file
 * Next.js falls back to its own unstyled, English, LTR error screen — a bad
 * experience for this app's Hebrew/RTL audience and a dead end with no way
 * back into the app short of editing the URL.
 */
export default function ErrorBoundary({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="min-h-screen bg-exam-paper flex items-center justify-center px-4" dir="rtl">
      <div className="text-center max-w-sm space-y-4">
        <AlertTriangle className="w-12 h-12 mx-auto text-exam-wrong" strokeWidth={1.5} aria-hidden />
        <h1 className="text-xl font-bold text-exam-ink">משהו השתבש</h1>
        <p className="text-exam-ink-soft text-sm leading-relaxed">
          קרתה שגיאה לא צפויה בטעינת העמוד. אפשר לנסות שוב, או לחזור לדף הבית.
        </p>
        <div className="flex flex-col gap-2 pt-2">
          <button
            onClick={reset}
            className="w-full py-3 bg-exam-accent text-exam-accent-ink rounded-sm font-bold hover:opacity-90 transition-opacity flex items-center justify-center gap-2"
          >
            <RotateCcw className="w-4 h-4" aria-hidden />נסה שוב
          </button>
          <Link
            href="/"
            className="w-full py-2.5 border border-exam-border text-exam-ink-soft rounded-sm text-sm hover:bg-exam-paper-alt transition-colors flex items-center justify-center gap-2"
          >
            <Home className="w-4 h-4" aria-hidden />חזרה לדף הבית
          </Link>
        </div>
      </div>
    </div>
  );
}
