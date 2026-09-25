import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, it, expect } from 'vitest';
import { ExemptionCard } from './ExemptionCard';

const render = (p: number, theta = 1.5, se = 0.4, score?: number) =>
  renderToStaticMarkup(createElement(ExemptionCard, { measurement: { theta, se, p }, heading: 'H', basis: 'המבחן הזה', score }));

describe('ExemptionCard', () => {
  it('shows the probability as an accessible meter', () => {
    const html = render(0.72);
    expect(html).toContain('72%');
    expect(html).toContain('role="meter"');
    expect(html).toContain('aria-valuenow="72"');
    expect(html).toContain('aria-valuetext="72% סיכוי לציון 134 ומעלה"');
  });

  it('frames it as a natural frequency', () => {
    expect(render(0.72)).toContain('בערך 7 מתוך 10 נבחנים עם תוצאה כמו שלך נמצאים');
    expect(render(0.1)).toContain('בערך אחד מתוך 10 נבחנים עם תוצאה כמו שלך נמצא ');
    expect(render(0.02)).toContain('פחות מאחד מתוך 10 נבחנים עם תוצאה כמו שלך נמצא ');
    expect(render(0.98)).toContain('כמעט כל הנבחנים עם תוצאה כמו שלך נמצאים');
    expect(render(0.72)).not.toContain('מתוך 10 נבחנים עם תוצאה כמו שלך, ');
  });

  it('picks the tone from the probability', () => {
    expect(render(0.85)).toContain('סיכוי גבוה לפטור');
    expect(render(0.5)).toContain('ממש על הקו');
    expect(render(0.1)).toContain('עוד בדרך לשם');
  });

  it('shows the real 80% range and precision, not a fixed ±10', () => {
    const html = render(0.5, 1.2, 0.45); // 112–136, ±9
    // LTR fragments are bidi-isolated so RTL text can't reorder them.
    expect(html).toContain('<bdi dir="ltr" class="font-semibold text-exam-ink tabular-nums">112–136</bdi>');
    expect(html).toContain('<bdi dir="ltr">±9</bdi> נק׳');
    expect(html).toContain('<bdi dir="ltr">134+</bdi>');
  });

  it('says what it is and is not', () => {
    const html = render(0.5);
    expect(html).toContain('על בסיס המבחן הזה');
    expect(html).toContain('לא תחזית רשמית');
  });

  it('marks the score on a left-to-right track only when given one', () => {
    expect(render(0.5, 1.2, 0.45, 124)).toContain('left:74%');
    expect(render(0.5, 1.2, 0.45)).not.toContain('bg-exam-ink shadow-surface');
  });
});
