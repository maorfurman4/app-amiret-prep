/**
 * Dev-only mobile layout audit. In development it is exposed as
 * `window.__mobileAudit()` (see src/components/DevMobileAudit.tsx): run it in
 * the console at a phone viewport (320 / 375px) on any page.
 *
 * Reports horizontal overflow (and the elements poking past the viewport)
 * and interactive elements whose tap area is under MIN_TARGET — counting the
 * invisible hit area the `hit-44` utility adds via ::after. Inline text links
 * inside running text are exempt (WCAG 2.5.8 inline exception).
 */
export const MIN_TARGET = 44;

const INTERACTIVE = 'a[href],button,input:not([type=hidden]),select,textarea,[role=button],[role=tab],[role=menuitem]';

export interface MobileAuditReport {
  path: string;
  viewport: number;
  overflowPx: number;
  overflowing: string[];
  smallTargets: { size: string; label: string }[];
}

function describe(el: Element): string {
  const label = el.getAttribute('aria-label') || el.textContent || el.tagName;
  return label.trim().replace(/\s+/g, ' ').slice(0, 32);
}

function tapSize(el: Element): { w: number; h: number } {
  const r = el.getBoundingClientRect();
  const after = getComputedStyle(el, '::after');
  if (after.position !== 'absolute') return { w: r.width, h: r.height };
  const w = parseFloat(after.width) || 0;
  const h = parseFloat(after.height) || 0;
  return { w: Math.max(r.width, w), h: Math.max(r.height, h) };
}

export function runMobileAudit(): MobileAuditReport {
  const vw = document.documentElement.clientWidth;
  const overflowPx = document.documentElement.scrollWidth - vw;

  const overflowing: string[] = [];
  if (overflowPx > 0) {
    for (const el of document.querySelectorAll('body *')) {
      const r = el.getBoundingClientRect();
      if ((r.right > vw + 1 || r.left < -1) && getComputedStyle(el).position !== 'fixed') {
        overflowing.push(`${el.tagName.toLowerCase()}.${(el.getAttribute('class') ?? '').slice(0, 60)} [${Math.round(r.left)}..${Math.round(r.right)}]`);
        if (overflowing.length >= 10) break;
      }
    }
  }

  const smallTargets: MobileAuditReport['smallTargets'] = [];
  for (const el of document.querySelectorAll(INTERACTIVE)) {
    const r = el.getBoundingClientRect();
    if (!r.width || !r.height) continue;
    if (getComputedStyle(el).display === 'inline' && el.closest('p, li')) continue;
    const { w, h } = tapSize(el);
    if (w < MIN_TARGET || h < MIN_TARGET) {
      smallTargets.push({ size: `${Math.round(w)}×${Math.round(h)}`, label: describe(el) });
    }
  }

  return { path: location.pathname + location.search, viewport: vw, overflowPx, overflowing, smallTargets };
}
