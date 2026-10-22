import { readFileSync } from 'node:fs';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { readWordAudio, setWordAudio, speakWord } from './sound-preference';

const store = new Map<string, string>();
const speak = vi.fn();
const cancel = vi.fn();

beforeEach(() => {
  store.clear();
  speak.mockClear();
  cancel.mockClear();
  vi.stubGlobal('localStorage', {
    getItem: (k: string) => store.get(k) ?? null,
    setItem: (k: string, v: string) => void store.set(k, v),
  });
  vi.stubGlobal('window', { speechSynthesis: { speak, cancel }, dispatchEvent: vi.fn() });
  vi.stubGlobal('SpeechSynthesisUtterance', class { lang = ''; rate = 1; pitch = 1; constructor(public text: string) {} });
});

describe('word pronunciation preference', () => {
  it('is on by default and speaks the word', () => {
    expect(readWordAudio()).toBe(true);
    speakWord('abandon');
    expect(speak).toHaveBeenCalledWith(expect.objectContaining({ text: 'abandon', lang: 'en-US' }));
  });

  it('persists "off" in localStorage and keeps speakWord silent', () => {
    setWordAudio(false);
    expect(store.get('amiret_word_audio')).toBe('off');
    expect(readWordAudio()).toBe(false);
    speakWord('abandon');
    expect(speak).not.toHaveBeenCalled();
  });

  it('speaks again once turned back on', () => {
    setWordAudio(false);
    setWordAudio(true);
    speakWord('abandon');
    expect(speak).toHaveBeenCalledOnce();
  });

  it('is the only way the vocabulary screens speak', () => {
    for (const page of ['../app/vocabulary/page.tsx', '../app/today/page.tsx']) {
      const src = readFileSync(new URL(page, import.meta.url), 'utf8');
      expect(src).toMatch(/from '@\/lib\/sound-preference'/);
      expect(src).not.toContain('speechSynthesis.speak(');
    }
  });

  it('falls back to on when storage is unavailable', () => {
    vi.stubGlobal('localStorage', { getItem: () => { throw new Error('blocked'); } });
    expect(readWordAudio()).toBe(true);
  });
});
