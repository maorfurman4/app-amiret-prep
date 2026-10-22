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
    // Home "היום שלך": the review line and plan text on the green card, the CTA's count badge.
    ['exam-ink-soft', 'exam-sage-bg'], ['on-emerald', 'exam-sage-strong'],
    // Home exam-date picker: weekday names, the picked day, the active month chip.
    ['exam-ink-soft', 'exam-surface'], ['exam-accent-ink', 'exam-accent'],
    // Recessed panels (results breakdown by type, /stats types): the accuracy colors on paper-alt.
    ...['exam-sage-strong', 'exam-alt', 'exam-wrong'].map(fg => [fg, 'exam-paper-alt']),
  ];
  // Account popover: text, plus its focus ring (menu-accent) and field outline at 3:1.
  const menuPairs = [
    ...['menu-surface', 'menu-hover'].flatMap(bg =>
      ['menu-ink', 'menu-ink-soft', 'menu-accent', 'menu-danger', 'menu-success'].map(fg => [fg, bg])),
    ['menu-danger', 'menu-danger-bg'], ['menu-accent-ink', 'menu-accent'],
  ];
  const menuUiPairs = [
    ['menu-accent', 'menu-surface'], ['menu-accent', 'menu-hover'], ['menu-accent', 'menu-danger-bg'],
    ['menu-border-input', 'menu-surface'],
  ];
  // /stats score panel: every label on the navy, incl. the green 134 and amber best-score text.
  const statsPairs = ['stats-hero-ink', 'stats-hero-soft', 'stats-gate', 'stats-best', 'stats-fill'].map(fg => [fg, 'stats-hero']);
  const ratio = (fg: string, bg: string) => {
    const a = luminance(tokens[fg]), b = luminance(tokens[bg]);
    return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
  };
  describe(`${selector} text contrast`, () => {
    it.each([...pairs, ...menuPairs, ...statsPairs, ['stats-line', 'exam-paper']])('%s on %s meets 4.5:1', (fg, bg) => {
      expect(ratio(fg, bg)).toBeGreaterThanOrEqual(4.5);
    });
  });
  // Home exam-date picker: today's ring, the focus outline and the chip borders against the card.
  const pickerUiPairs = [['exam-accent', 'exam-surface'], ['exam-border-input', 'exam-surface']];
  describe(`${selector} UI contrast`, () => {
    it.each([...menuUiPairs, ...pickerUiPairs])('%s on %s meets 3:1', (fg, bg) => {
      expect(ratio(fg, bg)).toBeGreaterThanOrEqual(3);
    });
  });
}
