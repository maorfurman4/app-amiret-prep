import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import { addLocalDays } from '@/lib/date-local';

const state = vi.hoisted(() => ({ loading: false, today: '2026-10-22' }));
vi.mock('@/lib/dashboard-context', () => ({ useDashboardSummary: () => ({ data: null, loading: state.loading }) }));
vi.mock('@/lib/date-local', async importOriginal => ({
  ...(await importOriginal<typeof import('@/lib/date-local')>()),
  todayLocalStr: () => state.today,
}));

import { DailySlogan, SLOGANS, sloganFor } from './DailySlogan';

describe('sloganFor', () => {
  it('draws from the exact list of 20', () => {
    expect(SLOGANS).toHaveLength(20);
    expect(new Set(SLOGANS).size).toBe(20);
    expect(SLOGANS[0]).toBe('כל שאלה שאתה פותר מקרבת אותך לפטור.');
    expect(SLOGANS[19]).toBe('אתה כאן שוב, וזה בדיוק מה שעובד.');
  });

  it('is stable within a day', () => {
    expect(sloganFor('2026-10-22')).toBe(sloganFor('2026-10-22'));
  });

  it('picks by day of year mod 20', () => {
    expect(sloganFor('2026-01-01')).toBe(SLOGANS[0]);
    expect(sloganFor('2026-01-20')).toBe(SLOGANS[19]);
    expect(sloganFor('2026-01-21')).toBe(SLOGANS[0]);
  });

  it('changes every day, also across the new year, and shows all 20 in 20 days', () => {
    const days = Array.from({ length: 20 }, (_, i) => addLocalDays('2026-10-22', i));
    expect(new Set(days.map(sloganFor)).size).toBe(20);
    expect(sloganFor('2026-12-31')).not.toBe(sloganFor('2027-01-01'));
  });
});

describe('DailySlogan', () => {
  it('renders nothing until the page has settled (the day is the device\'s)', () => {
    state.loading = true;
    expect(renderToStaticMarkup(createElement(DailySlogan))).toBe('<p class="mt-3 min-h-[1.45em] text-[12.5px] leading-[1.45] text-exam-ink-soft"></p>');
    state.loading = false;
  });

  it('shows today\'s slogan, and tomorrow a different one', () => {
    state.today = '2026-10-22';
    const today = renderToStaticMarkup(createElement(DailySlogan));
    expect(today).toContain(sloganFor('2026-10-22'));
    state.today = '2026-10-23';
    expect(renderToStaticMarkup(createElement(DailySlogan))).not.toBe(today);
  });
});
