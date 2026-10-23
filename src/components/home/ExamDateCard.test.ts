import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const state = vi.hoisted(() => ({ data: null as unknown }));
vi.mock('@/lib/dashboard-context', () => ({ useDashboardSummary: () => ({ data: state.data, loading: false }) }));
vi.mock('@/lib/auth-fetch', () => ({ authFetch: vi.fn() }));
vi.mock('@/lib/date-local', async importOriginal => ({
  ...(await importOriginal<typeof import('@/lib/date-local')>()),
  todayLocalStr: () => '2026-09-23',
}));

import { ExamDateCard } from './ExamDateCard';

const render = (examDate: string | null, canSetExamDate = true) => {
  state.data = { examDate, canSetExamDate };
  return renderToStaticMarkup(createElement(ExamDateCard));
};

describe('ExamDateCard', () => {
  beforeEach(() => { state.data = null; });

  it('renders nothing until the dashboard data has loaded', () => {
    expect(renderToStaticMarkup(createElement(ExamDateCard))).toBe('');
  });

  it('asks a guest to sign in (dates live on the account)', () => {
    const html = render(null, false);
    expect(html).toContain('קבע תאריך מבחן');
    expect(html).toContain('התחבר כדי לשמור אותו');
    expect(html).toContain('href="/auth/login?next=/"');
  });

  it('offers a guest the official NITE booking page, in a new tab, without signing in', () => {
    const html = render(null, false);
    expect(html).toContain('לא קבעת עדיין מבחן?');
    expect(html).toMatch(/<a href="https:\/\/www\.nite\.org\.il\/other-tests\/amirnet\/" target="_blank" rel="noopener noreferrer"[^>]*>קבע מבחן/);
  });

  it('prompts a signed-in student without a date to set one', () => {
    const html = render(null);
    expect(html).toContain('קבע תאריך מבחן');
    expect(html).toContain('החזרות יתוזמנו לפיו');
    expect(html).not.toContain('בשיא ביום המבחן');
    expect(html).toContain('<button');
    expect(html).not.toContain('href=');
  });

  it('shows a countdown with an edit control once a date is set', () => {
    const html = render('2026-11-01');
    expect(html).toContain('עוד 39 ימים למבחן');
    expect(html).toContain('aria-label="שינוי תאריך המבחן"');
    expect(html).toContain('aria-label="הסרת תאריך המבחן"');
    expect(html).toContain('1 בנובמבר 2026');
  });

  it('shows only the countdown and the date, also inside the final two weeks', () => {
    const html = render('2026-10-01');
    expect(html).toContain('עוד 8 ימים למבחן');
    expect(html).toContain('1 באוקטובר 2026');
    expect(html).not.toContain('המרווחים בין החזרות מתקצרים');
  });

  it('handles tomorrow and today', () => {
    expect(render('2026-09-24')).toContain('המבחן מחר');
    expect(render('2026-09-25')).toContain('עוד יומיים למבחן');
    expect(render('2026-09-23')).toContain('המבחן היום');
  });

  it('treats a past date as needing a new one', () => {
    expect(render('2026-09-01')).toContain('תאריך המבחן עבר');
    expect(render('2026-09-01')).toContain('קבע את התאריך הבא');
  });
});
