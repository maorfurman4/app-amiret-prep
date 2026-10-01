import { readFileSync, readdirSync, statSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * Double-tapping a control must not zoom the page, while pinch-zoom stays
 * available. The fix is one base rule (touch-action: manipulation on every
 * interactive element) — these tests keep it, keep the viewport zoomable,
 * and catch tappable elements that bypass the rule (a clickable <div>).
 */

const SRC = path.resolve(__dirname, '..');
const css = readFileSync(path.join(SRC, 'app/globals.css'), 'utf8');
const layout = readFileSync(path.join(SRC, 'app/layout.tsx'), 'utf8');

const COVERED_TAGS = ['a', 'button', 'input', 'select', 'textarea', 'label', 'summary'];

function tsxFiles(dir: string): string[] {
  return readdirSync(dir).flatMap(name => {
    const p = path.join(dir, name);
    if (statSync(p).isDirectory()) return tsxFiles(p);
    return p.endsWith('.tsx') && !p.includes('.test.') ? [p] : [];
  });
}

/**
 * Lower-case JSX elements that take a tap handler but aren't covered by the
 * base rule (by tag or interactive role) and set no touch-* utility of their own.
 */
export function uncoveredTapTargets(source: string): string[] {
  const out: string[] = [];
  for (const m of source.matchAll(/\b(onClick|onPointerUp|onTouchEnd)=/g)) {
    // Walk back to the JSX opener this prop belongs to, skipping {...} expressions.
    let depth = 0;
    let j = m.index!;
    while (j > 0) {
      j--;
      const c = source[j];
      if (c === '}') depth++;
      else if (c === '{' && depth > 0) depth--;
      else if (c === '<' && depth === 0 && /[A-Za-z]/.test(source[j + 1] ?? '')) break;
    }
    const tag = /^<([A-Za-z][\w.]*)/.exec(source.slice(j))?.[1];
    if (!tag || tag[0] !== tag[0].toLowerCase() || COVERED_TAGS.includes(tag)) continue;
    const end = source.indexOf('>', m.index!);
    const opener = source.slice(j, end === -1 ? undefined : end);
    if (/role="(button|link|radio|checkbox|switch|tab|option|menuitem|slider)"/.test(opener)) continue;
    if (/\btouch-(manipulation|pan-[xy]|none)\b/.test(opener)) continue;
    out.push(`<${tag}> line ${source.slice(0, j).split('\n').length}`);
  }
  return out;
}

describe('double-tap zoom', () => {
  it('the base layer gives every interactive element touch-action: manipulation', () => {
    const base = css.slice(css.indexOf('@layer base')).replace(/\/\*[\s\S]*?\*\//g, '');
    const rule = /([^{}]+)\{\s*touch-action:\s*manipulation;\s*\}/.exec(base);
    expect(rule).not.toBeNull();
    const selectors = rule![1].split(',').map(s => s.trim());
    for (const tag of [...COVERED_TAGS, '[role="button"]', '[role="radio"]', '[role="menuitem"]']) {
      expect(selectors).toContain(tag);
    }
  });

  it('the viewport stays zoomable (no maximum-scale / user-scalable lock)', () => {
    const viewport = layout.slice(layout.indexOf('export const viewport'));
    expect(viewport).not.toMatch(/maximumScale|userScalable|maximum-scale|user-scalable/);
  });

  it('no tappable element bypasses the rule', () => {
    const offenders = tsxFiles(SRC).flatMap(f =>
      uncoveredTapTargets(readFileSync(f, 'utf8')).map(o => `${path.relative(SRC, f)}: ${o}`));
    expect(offenders).toEqual([]);
  });

  it('negative control: the scan does flag a bare clickable <div>', () => {
    expect(uncoveredTapTargets('<div className="card" onClick={() => go()}>x</div>')).toHaveLength(1);
    expect(uncoveredTapTargets('<div className="touch-manipulation" onClick={go} />')).toHaveLength(0);
    expect(uncoveredTapTargets('<button onClick={go}>x</button>')).toHaveLength(0);
  });
});
