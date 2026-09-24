import { Fragment, type ReactNode } from 'react';

// A run of English inside Hebrew copy: starts at a Latin letter (optionally
// preceded by an opening quote/paren that belongs to it) and extends over any
// non-Hebrew characters up to the last Latin letter, digit or closing mark.
const LATIN_RUN = /(?:["“(](?=[A-Za-z]))?[A-Za-z](?:[^֐-׿]*[A-Za-z0-9.…"”)])?/g;

/**
 * Wraps English runs in LTR isolates so mixed Hebrew/English strategy copy
 * keeps its word order — without it, "(No sooner... / Had the...)?" renders
 * scrambled inside an RTL paragraph.
 */
function isolateLatin(text: string, keyPrefix: string): ReactNode[] {
  const out: ReactNode[] = [];
  let last = 0;
  for (const m of text.matchAll(LATIN_RUN)) {
    if (m.index > last) out.push(text.slice(last, m.index));
    out.push(<bdi key={`${keyPrefix}-${m.index}`} dir="ltr">{m[0]}</bdi>);
    last = m.index + m[0].length;
  }
  if (last < text.length) out.push(text.slice(last));
  return out;
}

/** Renders strategy copy: **double-asterisk** spans become emphasis, English runs are bidi-isolated. */
export function RichText({ text }: { text: string }) {
  const parts = text.split(/\*\*(.+?)\*\*/g);
  return (
    <>
      {parts.map((part, i) =>
        i % 2 === 1
          ? <span key={i} className="font-semibold text-exam-ink">{isolateLatin(part, String(i))}</span>
          : <Fragment key={i}>{isolateLatin(part, String(i))}</Fragment>,
      )}
    </>
  );
}
