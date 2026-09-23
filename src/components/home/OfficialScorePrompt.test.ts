import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { afterEach, describe, expect, it, vi } from 'vitest';

const state = vi.hoisted(() => ({ data: null as unknown }));
vi.mock('@/lib/dashboard-context', () => ({ useDashboardSummary: () => ({ data: state.data, loading: false, patch: () => {} }) }));
vi.mock('@/lib/auth-fetch', () => ({ authFetch: vi.fn() }));
vi.mock('@/lib/date-local', async importOriginal => ({
  ...(await importOriginal<typeof import('@/lib/date-local')>()),
  todayLocalStr: () => '2026-09-23',
}));

import { OfficialScorePrompt } from './OfficialScorePrompt';
import { ExamDateCard } from './ExamDateCard';

const render = (el: typeof OfficialScorePrompt | typeof ExamDateCard, data: unknown) => {
  state.data = data;
  return renderToStaticMarkup(createElement(el));
};
const pending = { officialScorePrompt: { testDate: '2026-09-20' }, examDate: '2026-09-20', canSetExamDate: true };

describe('OfficialScorePrompt', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('renders nothing without a pending prompt', () => {
    expect(render(OfficialScorePrompt, null)).toBe('');
    expect(render(OfficialScorePrompt, { ...pending, officialScorePrompt: null })).toBe('');
  });

  it('asks about the specific sitting, with a labelled numeric field and test-type choice', () => {
    const html = render(OfficialScorePrompt, pending);
    expect(html).toContain('איך הלך המבחן ב-20 בספטמבר?');
    expect(html).toContain('inputMode="numeric"');
    expect(html).toMatch(/<label for="([^"]+)"[\s\S]*<input id="\1"/);
    expect(html).toContain('role="radiogroup"');
    expect(html).toMatch(/aria-checked="true"[^>]*>אמירנ&quot;ט</); // AMIRNET preselected
    expect(html).toContain('נשמר בחשבון שלך בלבד');
  });

  it('offers both ways out: not yet, and prefer not to', () => {
    const html = render(OfficialScorePrompt, pending);
    expect(html).toContain('עוד לא קיבלתי ציון');
    expect(html).toContain('מעדיף לא לשתף');
  });

  it('stays hidden while snoozed on this device', () => {
    vi.stubGlobal('localStorage', { getItem: () => '2026-09-25', setItem: () => {} });
    expect(render(OfficialScorePrompt, pending)).toBe('');
    vi.stubGlobal('localStorage', { getItem: () => '2026-09-22', setItem: () => {} }); // expired
    expect(render(OfficialScorePrompt, pending)).not.toBe('');
  });

  it('takes the exam-date slot: the date card yields while the prompt is pending', () => {
    expect(render(ExamDateCard, pending)).toBe('');
    expect(render(ExamDateCard, { ...pending, officialScorePrompt: null })).toContain('תאריך המבחן עבר');
  });
});
