'use client';

import { useEffect } from 'react';
import './globals.css';

/**
 * Catches an error thrown by the root layout itself (fonts, providers,
 * BottomNav) — the one case error.tsx can't cover, since error.tsx renders
 * *inside* the layout. Next.js requires this file to render its own
 * <html>/<body>; it fully replaces the app shell when it fires, so it's
 * deliberately minimal and dependency-free rather than reusing components
 * that might be part of what just crashed.
 */
export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <html lang="he" dir="rtl" className="h-full">
      <body className="min-h-full flex items-center justify-center bg-exam-paper px-4">
        <div className="text-center max-w-sm space-y-4">
          <h1 className="text-xl font-bold text-exam-ink">האתר נתקל בשגיאה</h1>
          <p className="text-exam-ink-soft text-sm leading-relaxed">
            קרתה שגיאה שמנעה מהעמוד לטעון. אפשר לנסות לרענן.
          </p>
          <button
            onClick={reset}
            className="w-full py-3 bg-exam-accent text-exam-accent-ink rounded-sm font-bold hover:opacity-90 transition-opacity"
          >
            נסה שוב
          </button>
        </div>
      </body>
    </html>
  );
}
