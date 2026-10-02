/**
 * Page-level keyboard shortcuts (1–4 picks an answer, Enter/Space goes on,
 * arrows mark a flashcard) listen on `window`, so they also see keys meant
 * for whatever control has focus. A shortcut that swallows those keys breaks
 * keyboard use: Enter on a focused "סיים פרק" button used to move to the next
 * question instead of submitting the section.
 *
 * `focusedControlOwnsKey` says whether the key belongs to the focused control,
 * in which case the shortcut must do nothing (and must not preventDefault).
 */

const TEXT_ENTRY = 'input, textarea, select, [contenteditable=""], [contenteditable="true"]';
const ACTIVATABLE = 'a[href], button, summary, [role="button"], [role="link"], [role="checkbox"], [role="switch"], [role="radio"], [role="tab"], [role="menuitem"], [role="option"]';
const ARROW_WIDGET = '[role="radio"], [role="tab"], [role="slider"], [role="option"], [role="menuitem"], [role="spinbutton"]';

interface ClosestTarget { closest(selector: string): unknown }

function asElement(target: EventTarget | null): ClosestTarget | null {
  return target && typeof (target as Partial<ClosestTarget>).closest === 'function' ? target as unknown as ClosestTarget : null;
}

export function focusedControlOwnsKey(target: EventTarget | null, key: string): boolean {
  const el = asElement(target);
  if (!el) return false;
  // Typing fields own every key.
  if (el.closest(TEXT_ENTRY)) return true;
  // Enter/Space activate the focused button or link.
  if ((key === 'Enter' || key === ' ') && el.closest(ACTIVATABLE)) return true;
  // Arrow keys move within radio groups, tabs, sliders and menus.
  if (key.startsWith('Arrow') && el.closest(ARROW_WIDGET)) return true;
  return false;
}
