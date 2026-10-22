import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import { EMPTY_TODAY } from '@/lib/today-activity';

const state = vi.hoisted(() => ({ data: null as unknown }));
vi.mock('@/lib/dashboard-context', () => ({ useDashboardSummary: () => ({ data: state.data, loading: false }) }));

import { TodaySessionCta } from './TodaySessionCta';

const render = (done: number, due: number) => {
  state.data = {
    today: EMPTY_TODAY,
    rings: { effort: { done: 3, target: 15 }, retention: { done, due }, simulation: { done: false } },
  };
  return renderToStaticMarkup(createElement(TodaySessionCta));
};

describe('Today: the daily review goal', () => {
  it('asks for 8 of a 330 backlog, with an honest badge and a calm line', () => {
    const html = render(0, 330);
    expect(html).toContain('>0/8<');
    expect(html).toContain('8 חזרות להיום');
    expect(html).toContain('שאר החזרות יחכו לימים הבאים, 8 בכל יום.');
    expect(html).not.toMatch(/330|329|99\+/);
  });

  it('marks the goal done after one session and drops the badge', () => {
    const html = render(8, 322);
    expect(html).toContain('>8/8<');
    expect(html).toContain('aria-label="הושלם"');
    expect(html).toContain('סיימת את החזרות של היום. את השאר נמשיך מחר.');
    expect(html).not.toContain('חזרות להיום');
  });

  it('shows a small queue as is, with no "rest waits" line', () => {
    const html = render(0, 3);
    expect(html).toContain('>0/3<');
    expect(html).toContain('3 חזרות להיום');
    expect(html).not.toContain('יחכו');
  });

  it('says there is nothing today when nothing is due', () => {
    const html = render(0, 0);
    expect(html).toContain('אין להיום');
    expect(html).not.toContain('חזרות להיום');
  });
});
