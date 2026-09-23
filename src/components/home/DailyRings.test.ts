import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { DailyRings } from './DailyRings';

function render(reviewClearedToday: number, reviewStillDue: number) {
  return renderToStaticMarkup(createElement(DailyRings, {
    activityUnitsToday: 0, dailyActivityTarget: 15, reviewClearedToday, reviewStillDue,
  }));
}

describe('daily review progress', () => {
  it('represents an empty queue as caught up without inventing work or practice completion', () => {
    const html = render(0, 0);
    expect(html).toContain('הכול מעודכן');
    expect(html).toContain('אין חזרות שממתינות לך כרגע');
    expect(html).not.toContain('>0/1<');
    expect(html).toContain('>0/15<');
    expect(html).not.toMatch(/NaN|Infinity/);
  });

  it('keeps outstanding review work visible', () => {
    const html = render(2, 3);
    expect(html).toContain('>2/5<');
    expect(html).not.toContain('הכול מעודכן');
  });

  it('recognizes completed reviews with an accurate count', () => {
    const html = render(5, 0);
    expect(html).toContain('הכול מעודכן');
    expect(html).toContain('השלמת 5 חזרות');
  });
});
