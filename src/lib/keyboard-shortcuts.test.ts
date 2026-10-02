import { describe, expect, it } from 'vitest';
import { focusedControlOwnsKey } from './keyboard-shortcuts';

// Stand-in for a DOM element: matches a selector list when it contains this
// element's own simple selector (the test env has no DOM).
const el = (self: string) => ({
  closest: (selectorList: string) => selectorList.split(',').map(s => s.trim()).includes(self) || null,
}) as unknown as EventTarget;

describe('focusedControlOwnsKey', () => {
  it('leaves Enter/Space to a focused button or link', () => {
    expect(focusedControlOwnsKey(el('button'), 'Enter')).toBe(true);
    expect(focusedControlOwnsKey(el('button'), ' ')).toBe(true);
    expect(focusedControlOwnsKey(el('a[href]'), 'Enter')).toBe(true);
    expect(focusedControlOwnsKey(el('[role="radio"]'), ' ')).toBe(true);
  });

  it('lets page shortcuts handle digits and arrows on a plain button', () => {
    expect(focusedControlOwnsKey(el('button'), '1')).toBe(false);
    expect(focusedControlOwnsKey(el('button'), 'ArrowRight')).toBe(false);
  });

  it('leaves arrows to radio groups and tabs', () => {
    expect(focusedControlOwnsKey(el('[role="radio"]'), 'ArrowLeft')).toBe(true);
    expect(focusedControlOwnsKey(el('[role="tab"]'), 'ArrowRight')).toBe(true);
  });

  it('leaves every key to text fields', () => {
    expect(focusedControlOwnsKey(el('input'), '1')).toBe(true);
    expect(focusedControlOwnsKey(el('textarea'), 'Enter')).toBe(true);
  });

  it('lets shortcuts run when nothing in particular has focus', () => {
    expect(focusedControlOwnsKey(el('div'), 'Enter')).toBe(false);
    expect(focusedControlOwnsKey(null, ' ')).toBe(false);
    expect(focusedControlOwnsKey({} as EventTarget, 'Enter')).toBe(false);
  });
});
