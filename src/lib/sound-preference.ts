'use client';

import { useSyncExternalStore } from 'react';

/**
 * Word pronunciation (the speaker buttons in the vocabulary screens). Stored
 * per device; defaults to on. When off, speak() stays silent.
 */
const KEY = 'amiret_word_audio';
const EVENT = 'amiret-word-audio-change';

export function readWordAudio(): boolean {
  try {
    return localStorage.getItem(KEY) !== 'off';
  } catch {
    return true;
  }
}

export function setWordAudio(enabled: boolean): void {
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

export function useWordAudio(): boolean {
  return useSyncExternalStore(subscribe, readWordAudio, () => true);
}

/** Says an English word aloud, unless pronunciation is turned off. */
export function speakWord(word: string): void {
  if (typeof window === 'undefined' || !readWordAudio()) return;
  window.speechSynthesis.cancel();
  const u = new SpeechSynthesisUtterance(word);
  u.lang = 'en-US';
  u.rate = 0.85;
  u.pitch = 1;
  window.speechSynthesis.speak(u);
}
