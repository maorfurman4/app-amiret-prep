'use client';

import { useSyncExternalStore } from 'react';

/**
 * "Real exam mode": the student can hide the pace gauge, since the real test
 * has none. Stored per device; defaults to showing the gauge.
 */
const KEY = 'amiret_pace_hint';
const EVENT = 'amiret-pace-hint-change';

export function readPaceHint(): boolean {
  try {
    return localStorage.getItem(KEY) !== 'off';
  } catch {
    return true;
  }
}

export function setPaceHint(enabled: boolean): void {
  try {
    localStorage.setItem(KEY, enabled ? 'on' : 'off');
  } catch { /* the in-page toggle still works this session */ }
  window.dispatchEvent(new Event(EVENT));
}

function subscribe(listener: () => void) {
  window.addEventListener(EVENT, listener);
  window.addEventListener('storage', listener);
  return () => {
    window.removeEventListener(EVENT, listener);
    window.removeEventListener('storage', listener);
  };
}

export function usePaceHint(): boolean {
  return useSyncExternalStore(subscribe, readPaceHint, () => true);
}
