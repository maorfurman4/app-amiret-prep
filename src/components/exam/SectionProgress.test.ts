import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { SECTION_CONFIGS } from '@/types/exam';
import { SectionProgress } from './SectionProgress';

const render = (currentSection: number, completedSections: number[] = []) =>
  renderToStaticMarkup(createElement(SectionProgress, { currentSection, completedSections }));

describe('SectionProgress', () => {
  it('shows every section the exam serves, in order', () => {
    const html = render(1);
    const steps = [...html.matchAll(/פרק (\d+)/g)].map(m => Number(m[1]));
    expect(steps).toEqual(SECTION_CONFIGS.map(c => c.index));
    expect(steps).toHaveLength(SECTION_CONFIGS.length);
  });

  it('fits the strip without sideways scrolling, so no section hides off-screen', () => {
    expect(render(1)).not.toMatch(/overflow-x-(auto|scroll)/);
  });

  it('marks done and current steps as the exam advances', () => {
    const html = render(5, [1, 2, 3, 4]);
    expect(html.match(/הושלם/g)).toHaveLength(4);
    expect(html).toContain('פרק 5, הפרק הנוכחי');
    expect(html.match(/aria-current="step"/g)).toHaveLength(1);
  });
});
