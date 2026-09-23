import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const css = readFileSync(new URL('../app/globals.css', import.meta.url), 'utf8');
function luminance(hex: string) {
  const channels = hex.match(/[a-f\d]{2}/gi)!.map(value => {
    const v = parseInt(value, 16) / 255;
    return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
  });
  return channels[0] * 0.2126 + channels[1] * 0.7152 + channels[2] * 0.0722;
}

for (const selector of [':root', '.dark']) {
  const block = css.slice(css.indexOf(`${selector} {`)).split('}')[0];
  const tokens = Object.fromEntries([...block.matchAll(/--([\w-]+):\s*(#[a-f\d]{6})/gi)].map(m => [m[1], m[2]]));
  const pairs = [
    ...['exam-paper', 'exam-surface', 'exam-paper-alt', 'exam-sage-bg', 'exam-alt-bg', 'exam-wrong-bg'].flatMap(bg =>
      ['exam-ink', 'exam-ink-soft', 'exam-accent'].map(fg => [fg, bg])),
    ...['sage', 'sage-strong', 'alt', 'wrong'].flatMap(status =>
      ['exam-paper', 'exam-surface', `exam-${status === 'sage-strong' ? 'sage' : status}-bg`].map(bg => [`exam-${status}`, bg])),
    ['exam-accent-ink', 'exam-accent'],
    ['on-emerald', 'exam-sage'], ['on-emerald', 'exam-sage-strong'],
    ['on-amber', 'exam-alt'], ['on-danger', 'exam-wrong'],
  ];
  describe(`${selector} text contrast`, () => {
    it.each(pairs)('%s on %s meets 4.5:1', (fg, bg) => {
      const a = luminance(tokens[fg]), b = luminance(tokens[bg]);
      expect((Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05)).toBeGreaterThanOrEqual(4.5);
    });
  });
}
