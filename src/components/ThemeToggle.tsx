'use client';

import { useSyncExternalStore } from 'react';

function subscribeTheme(listener: () => void) {
  const observer = new MutationObserver(listener);
  observer.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });
  return () => observer.disconnect();
}
const readTheme = () => document.documentElement.classList.contains('dark');
const serverTheme = () => false;

export function ThemeToggle() {
  const isDark = useSyncExternalStore(subscribeTheme, readTheme, serverTheme);

  const toggle = () => {
    const next = !isDark;
    try { localStorage.setItem('theme', next ? 'dark' : 'light'); } catch { /* The in-page theme still works. */ }
    document.documentElement.classList.toggle('dark', next);
  };

  return (
    <button
      onClick={toggle}
      aria-label={isDark ? 'מעבר למצב בהיר' : 'מעבר למצב כהה'}
      className="w-9 h-9 rounded-full bg-white/80 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 flex items-center justify-center text-base shadow-sm hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors backdrop-blur-sm"
    >
      {isDark ? '☀️' : '🌙'}
    </button>
  );
}
