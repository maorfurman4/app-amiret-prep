import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { DailyRings } from './DailyRings';

function render(o: { effort?: number; target?: number; done?: number; due?: number; sim?: boolean } = {}) {
  return renderToStaticMarkup(createElement(DailyRings, { rings: {
    effort: { done: o.effort ?? 0, target: o.target ?? 15 },
    retention: { done: o.done ?? 0, due: o.due ?? 0 },
    simulation: { done: o.sim ?? false },
  } }));
}

describe('three learning rings', () => {
  it('renders all three rings with their labels and never NaN', () => {
    const html = render();
    expect(html.match(/<circle/g)).toHaveLength(6); // track + fill per ring
    for (const label of ['תרגול מאתגר', 'חזרות בזמן', 'סימולציה שבועית']) expect(html).toContain(label);
    expect(html).toContain('>0/15<');
    expect(html).not.toMatch(/NaN|Infinity/);
  });

  it('shows outstanding due reviews as done/total', () => {
    const html = render({ done: 2, due: 3 });
    expect(html).toContain('>2/5<');
    expect(html).not.toContain('אין חזרות ממתינות');
  });

  it('an empty queue is caught up, with an honest count of what was done', () => {
    expect(render({ done: 0, due: 0 })).toContain('אין חזרות ממתינות');
    expect(render({ done: 4, due: 0 })).toContain('הכול מעודכן · 4 הושלמו');
  });

  it('marks the weekly simulation', () => {
    expect(render({ sim: false })).toContain('עוד לא השבוע');
    expect(render({ sim: true })).toContain('עשית השבוע');
  });

  it('only marks completion when all three rings are closed', () => {
    const pop = 'כל טבעות הלמידה הושלמו';
    expect(render({ effort: 15, done: 3, due: 0, sim: false })).not.toContain(pop);
    expect(render({ effort: 14, done: 3, due: 0, sim: true })).not.toContain(pop);
    expect(render({ effort: 15, done: 3, due: 0, sim: true })).toContain(pop);
  });
});
