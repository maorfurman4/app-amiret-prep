// @vitest-environment happy-dom
import { act, createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const m = vi.hoisted(() => ({ data: null as unknown, authFetch: vi.fn() }));
vi.mock('@/lib/dashboard-context', () => ({ useDashboardSummary: () => ({ data: m.data, loading: false }) }));
vi.mock('@/lib/auth-fetch', () => ({ authFetch: m.authFetch }));
vi.mock('@/lib/date-local', async importOriginal => ({
  ...(await importOriginal<typeof import('@/lib/date-local')>()),
  todayLocalStr: () => '2026-09-23',
}));
vi.mock('next/link', async () => {
  const { createElement: h } = await import('react');
  return { default: ({ href, ...rest }: { href: string }) => h('a', { href, ...rest }) };
});

import { ExamDateCard, NITE_AMIRNET_URL } from './ExamDateCard';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let root: Root | null = null;
async function render(examDate: string | null, canSetExamDate = true) {
  m.data = { examDate, canSetExamDate, officialScorePrompt: null };
  const host = document.createElement('div');
  document.body.append(host);
  root = createRoot(host);
  await act(async () => { root!.render(createElement(ExamDateCard)); });
}
const button = (text: string) => [...document.querySelectorAll<HTMLButtonElement>('button')].find(b => b.textContent?.trim() === text)!;
const bookingLink = () => document.querySelector<HTMLAnchorElement>('[data-book-real-exam] a');

function expectBookingLink() {
  const a = bookingLink()!;
  expect(a.closest('[data-book-real-exam]')!.textContent).toContain('לא קבעת עדיין מבחן?');
  expect(a.textContent).toContain('קבע מבחן');
  expect(a.getAttribute('href')).toBe('https://www.nite.org.il/other-tests/amirnet/');
  expect(new URL(a.href).search).toBe('');
  expect(a.getAttribute('target')).toBe('_blank');
  expect(a.getAttribute('rel')).toBe('noopener noreferrer');
}

beforeEach(() => {
  vi.clearAllMocks();
  m.authFetch.mockResolvedValue(new Response('{}', { status: 200 }));
});
afterEach(async () => {
  await act(async () => root?.unmount());
  root = null;
  document.body.innerHTML = '';
});

describe('booking the real exam from the exam-date card', () => {
  it('uses the official NITE AMIRNET page, with no query', () => {
    expect(NITE_AMIRNET_URL).toBe('https://www.nite.org.il/other-tests/amirnet/');
  });

  it('shows in the editor of a signed-in student without a date', async () => {
    await render(null);
    expect(bookingLink()).toBeNull();
    // The no-date prompt is the card's one button.
    await act(async () => document.querySelector<HTMLButtonElement>('button')!.click());
    expect(document.querySelector('form')).not.toBeNull();
    expectBookingLink();
  });

  it('shows in the editor opened to change an upcoming date', async () => {
    await render('2026-11-01');
    expect(bookingLink()).toBeNull();
    await act(async () => document.querySelector<HTMLButtonElement>('button[aria-label="שינוי תאריך המבחן"]')!.click());
    expectBookingLink();
  });

  it('shows for a guest beside the sign-in prompt', async () => {
    await render(null, false);
    expect(document.querySelector('a[href="/auth/login?next=/"]')).not.toBeNull();
    expectBookingLink();
  });

  it('leaves saving and clearing the internal date as they were', async () => {
    await render('2026-11-01');
    await act(async () => document.querySelector<HTMLButtonElement>('button[aria-label="שינוי תאריך המבחן"]')!.click());
    await act(async () => { document.querySelector('form')!.requestSubmit(); });
    expect(m.authFetch).toHaveBeenCalledWith('/api/goals', expect.objectContaining({ method: 'PUT', body: JSON.stringify({ examDate: '2026-11-01' }) }));
    // Saved: back to the countdown, no booking line there.
    expect(document.querySelector('form')).toBeNull();
    expect(bookingLink()).toBeNull();

    await act(async () => document.querySelector<HTMLButtonElement>('button[aria-label="הסרת תאריך המבחן"]')!.click());
    expect(m.authFetch).toHaveBeenLastCalledWith('/api/goals', expect.objectContaining({ body: JSON.stringify({ examDate: null }) }));
    expect(button('ביטול')).toBeUndefined();
  });
});
