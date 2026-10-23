'use client';

import { useSyncExternalStore } from 'react';
import { Sun, Moon } from 'lucide-react';

function subscribeTheme(listener: () => void) {
  const observer = new MutationObserver(listener);
  observer.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });
  return () => observer.disconnect();
}
const readTheme = () => document.documentElement.classList.contains('dark');
const serverTheme = () => false;

export const useIsDark = () => useSyncExternalStore(subscribeTheme, readTheme, serverTheme);

export function setTheme(dark: boolean) {
  try { localStorage.setItem('theme', dark ? 'dark' : 'light'); } catch { /* The in-page theme still works. */ }
  document.documentElement.classList.toggle('dark', dark);
}

export function ThemeToggle() {
  const isDark = useIsDark();
  const toggle = () => setTheme(!isDark);

  return (
    <button
      onClick={toggle}
      aria-label={isDark ? 'מעבר למצב בהיר' : 'מעבר למצב כהה'}
      className="hit-44 w-9 h-9 rounded-full bg-exam-surface border border-exam-border flex items-center justify-center text-base hover:bg-exam-paper-alt transition-colors"
    >
      {isDark ? <Sun className="w-4 h-4" aria-hidden /> : <Moon className="w-4 h-4" aria-hidden />}
    </button>
  );
}
