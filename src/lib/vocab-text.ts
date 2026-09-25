/**
 * Vocabulary text comes from the database as typed: some definitions end with
 * a period and some don't, and some examples are wrapped in quote marks. The
 * cards show them as snippets, so this trims the wrapping quotes and, for
 * definitions, the final period. Ellipses, "?" and "!" are kept.
 */
const WRAPPING_QUOTES = /^\s*["'“”‘’„«]+|["'“”‘’„»]+\s*$/g;

export function cleanSnippet(text: string | null | undefined, { keepPeriod = false }: { keepPeriod?: boolean } = {}): string {
  if (!text) return '';
  let s = text.replace(WRAPPING_QUOTES, '').trim();
  if (!keepPeriod && /[^.]\.$/.test(s)) s = s.slice(0, -1).trimEnd();
  return s;
}
