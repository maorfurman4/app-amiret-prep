import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { ExamDatePicker, toDate, toDateStr } from './ExamDatePicker';

const render = (value = '') => renderToStaticMarkup(createElement(ExamDatePicker, {
  value, min: '2026-10-21', max: '2028-10-20', onChange: () => {}, labelledBy: 't',
}));

describe('ExamDatePicker', () => {
  it('round-trips a stored day without shifting it', () => {
    for (const s of ['2026-10-21', '2026-12-31', '2027-03-01']) expect(toDateStr(toDate(s))).toBe(s);
  });

  it('is an RTL Hebrew, Sunday-first month grid', () => {
    const html = render();
    expect(html).toContain('dir="rtl"');
    expect(html).toContain('אוקטובר 2026');
    expect(html).toMatch(/<th[^>]*aria-label="יום ראשון"/);
    expect(html).toContain('עבור לחודש הבא');
  });

  it('opens on the chosen month and marks the chosen day', () => {
    const html = render('2026-12-24');
    expect(html).toContain('דצמבר 2026');
    expect(html).toMatch(/aria-label="[^"]*24[^"]*נבחר"/);
  });

  it('offers a year of month chips, the active one pressed, with the year once it changes', () => {
    const html = render('2026-12-24');
    expect(html.match(/aria-pressed=/g)).toHaveLength(12);
    expect(html).toMatch(/aria-pressed="true"[^>]*>דצמבר</);
    expect(html).toContain('>ינואר 2027<');
  });

  it('disables the days before today', () => {
    expect(render()).toMatch(/<td[^>]*data-day="2026-10-20"[^>]*data-disabled="true"/);
  });
});
