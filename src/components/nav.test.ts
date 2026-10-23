// @vitest-environment happy-dom
import { act, createElement, useEffect, type ReactNode } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const route = vi.hoisted(() => ({ pathname: '/' }));
vi.mock('next/navigation', () => ({ usePathname: () => route.pathname }));
vi.mock('next/link', async () => {
  const { createElement: h } = await import('react');
  return { default: ({ href, ...rest }: { href: string }) => h('a', { href, ...rest }) };
});

import { BottomNav } from './BottomNav';
import { DesktopNav } from './DesktopNav';
import { NAV_ITEMS, SECONDARY_NAV_ITEMS } from '@/lib/nav';
import { ActivityGuardProvider, useActivityGuard } from '@/lib/activity-guard';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let root: Root;
let host: HTMLDivElement;

function MidActivity({ children }: { children: ReactNode }) {
  const { setInProgress } = useActivityGuard();
  useEffect(() => setInProgress(true), [setInProgress]);
  return children;
}

async function render(pathname: string, { midActivity = false } = {}) {
  route.pathname = pathname;
  host = document.createElement('div');
  document.body.append(host);
  root = createRoot(host);
  const navs = [createElement(BottomNav, { key: 'b' }), createElement(DesktopNav, { key: 'd' })];
  const tree = createElement(ActivityGuardProvider, null, midActivity ? createElement(MidActivity, null, navs) : navs);
  await act(async () => { root.render(tree); });
}

const bottomNav = () => host.querySelector<HTMLElement>('nav')!;
const trigger = () => host.querySelector<HTMLButtonElement>('button[aria-label="פתיחת תפריט ניווט"]');
const drawer = () => document.querySelector<HTMLElement>('[role="dialog"]');
const links = (scope: ParentNode) => [...scope.querySelectorAll<HTMLAnchorElement>('a')].map(a => [a.getAttribute('href'), a.textContent]);
const primaryLinks = () => links(drawer()!.querySelector('ul')!);
const current = (scope: ParentNode) => [...scope.querySelectorAll('a[aria-current="page"]')].map(a => a.getAttribute('href'));

async function openDrawer() {
  await act(async () => { trigger()!.click(); });
  return drawer()!;
}

beforeEach(() => { document.body.style.overflow = ''; });
afterEach(async () => {
  await act(async () => root.unmount());
  document.body.innerHTML = '';
});

describe('one nav source for mobile and desktop', () => {
  const expected = NAV_ITEMS.map(i => [i.href, i.label]);

  it('renders the same primary hrefs and labels in the bottom bar and the drawer', async () => {
    await render('/stats');
    expect(links(bottomNav())).toEqual(expected);
    await openDrawer();
    expect(primaryLinks()).toEqual(expected);
  });

  it('uses the canonical five, with "אוצר מילים" for vocabulary', () => {
    expect(expected).toEqual([
      ['/', 'בית'], ['/exam', 'מבחן'], ['/practice', 'תרגול'], ['/vocabulary', 'אוצר מילים'], ['/stats', 'סטטיסטיקה'],
    ]);
  });

  it('adds only the secondary destinations to the drawer, and no leaderboard', async () => {
    await render('/');
    const d = await openDrawer();
    expect(links(d)).toEqual([...expected, ...SECONDARY_NAV_ITEMS.map(i => [i.href, i.label])]);
    expect(SECONDARY_NAV_ITEMS.map(i => i.href)).toEqual(['/review-queue', '/strategies']);
    expect(d.innerHTML).not.toMatch(/leaderboard/i);
  });
});

describe('active item', () => {
  it.each([
    ['/', '/'],
    ['/practice', '/practice'],
    ['/practice/sentence-completion', '/practice'],
    ['/vocabulary', '/vocabulary'],
    ['/stats', '/stats'],
  ])('on %s marks %s in both navs', async (pathname, href) => {
    await render(pathname);
    expect(current(bottomNav())).toEqual([href]);
    expect(current(await openDrawer())).toEqual([href]);
  });

  it('marks a secondary destination in the drawer', async () => {
    await render('/review-queue');
    expect(current(bottomNav())).toEqual([]);
    expect(current(await openDrawer())).toEqual(['/review-queue']);
  });
});

describe('hidden during an active session', () => {
  it.each(['/exam/abc-123', '/review/abc-123', '/auth/login'])('hides both navs on %s', async pathname => {
    await render(pathname);
    expect(host.querySelector('nav')).toBeNull();
    expect(trigger()).toBeNull();
  });

  it('shows both on the exam start page', async () => {
    await render('/exam');
    expect(host.querySelector('nav')).not.toBeNull();
    expect(trigger()).not.toBeNull();
  });
});

describe('desktop drawer', () => {
  it('opens as a modal dialog with focus inside, on the current item', async () => {
    await render('/practice');
    expect(drawer()).toBeNull();
    const d = await openDrawer();
    expect(d.getAttribute('aria-modal')).toBe('true');
    expect(d.querySelector('nav')?.getAttribute('aria-label')).toBe('ניווט ראשי');
    expect(trigger()!.getAttribute('aria-expanded')).toBe('true');
    expect(document.activeElement?.getAttribute('href')).toBe('/practice');
  });

  it('closes on Escape and returns focus to the button', async () => {
    await render('/');
    await openDrawer();
    await act(async () => { document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' })); });
    expect(drawer()).toBeNull();
    expect(document.activeElement).toBe(trigger());
  });

  it('closes on ✕', async () => {
    await render('/');
    const d = await openDrawer();
    await act(async () => { d.querySelector<HTMLButtonElement>('button[aria-label="סגירת התפריט"]')!.click(); });
    expect(drawer()).toBeNull();
  });

  it('closes on the scrim', async () => {
    await render('/');
    await openDrawer();
    await act(async () => { document.querySelector<HTMLElement>('[data-nav-scrim]')!.click(); });
    expect(drawer()).toBeNull();
  });

  it('keeps Tab inside the drawer', async () => {
    await render('/');
    const d = await openDrawer();
    const focusables = [...d.querySelectorAll<HTMLElement>('a[href], button')];
    focusables[focusables.length - 1].focus();
    await act(async () => { document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab' })); });
    expect(document.activeElement).toBe(focusables[0]);
  });
});

describe('mid-activity guard', () => {
  it('asks before leaving, in both navs', async () => {
    await render('/practice', { midActivity: true });
    const tab = bottomNav().querySelector<HTMLAnchorElement>('a[href="/stats"]')!;
    const first = new MouseEvent('click', { bubbles: true, cancelable: true });
    await act(async () => { tab.dispatchEvent(first); });
    expect(first.defaultPrevented).toBe(true);
    expect(tab.textContent).toContain('לחץ שוב לצאת');

    const item = (await openDrawer()).querySelector<HTMLAnchorElement>('a[href="/exam"]')!;
    const click = new MouseEvent('click', { bubbles: true, cancelable: true });
    await act(async () => { item.dispatchEvent(click); });
    expect(click.defaultPrevented).toBe(true);
    expect(item.textContent).toContain('לחץ שוב לצאת');
  });
});
