/** Splits strategy copy into sentences: a break is whitespace after . ! or ?. */
export function splitSentences(text: string): string[] {
  return text
    .split(/(?<=[.!?])\s+(?=\S)/)
    .map(s => s.trim())
    .filter(Boolean);
}

/** True when `excerpt` is one sentence of `text`, or a run of consecutive ones, verbatim. */
export function isWholeSentenceRun(excerpt: string, text: string): boolean {
  const all = splitSentences(text);
  const want = splitSentences(excerpt);
  if (want.length === 0) return false;
  for (let i = 0; i + want.length <= all.length; i++) {
    if (want.every((s, j) => all[i + j] === s)) return true;
  }
  return false;
}

/** Groups sentences into short paragraphs so long bodies read as prose, not as one-line fragments. */
export function toParagraphs(text: string, perParagraph = 2): string[] {
  const sentences = splitSentences(text);
  const out: string[] = [];
  for (let i = 0; i < sentences.length; i += perParagraph) {
    out.push(sentences.slice(i, i + perParagraph).join(' '));
  }
  return out;
}
