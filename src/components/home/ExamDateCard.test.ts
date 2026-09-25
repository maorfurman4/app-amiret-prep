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
    expect(html).toContain('מתי המבחן שלך?');
    expect(html).toContain('href="/auth/login?next=/"');
  });

  it('prompts a signed-in student without a date to set one', () => {
    const html = render(null);
    expect(html).toContain('מתי המבחן שלך?');
    expect(html).toContain('<button');
    expect(html).not.toContain('href=');
  });

  it('shows a countdown with an edit control once a date is set', () => {
    const html = render('2026-11-01');
    expect(html).toContain('עוד 39 ימים למבחן');
    expect(html).toContain('aria-label="שינוי תאריך המבחן"');
  });

  it('mentions compression inside the final two weeks, and handles tomorrow/today', () => {
    expect(render('2026-10-01')).toContain('המרווחים בין החזרות מתקצרים');
    expect(render('2026-11-01')).not.toContain('המרווחים בין החזרות מתקצרים');
    expect(render('2026-09-24')).toContain('המבחן מחר');
    expect(render('2026-09-25')).toContain('עוד יומיים למבחן');
    expect(render('2026-09-23')).toContain('המבחן היום');
  });

  it('treats a past date as needing a new one', () => {
    expect(render('2026-09-01')).toContain('תאריך המבחן עבר');
  });
});
