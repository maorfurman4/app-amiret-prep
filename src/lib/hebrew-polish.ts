/**
 * Deterministic clean-up of the machine-written Hebrew in question
 * explanations (questions.explanation JSON + questions.hint). Used by
 * scripts/polish-explanations.ts; pure so it can be tested and re-run —
 * polishing already-polished text is a no-op.
 *
 * What it does, in order:
 *  1. "eng = gloss — reason"  →  "eng (gloss): reason"   (the dominant pattern)
 *  2. "Label — text"          →  "Label: text"           (short leading labels
 *     such as "הפוך", "❌ שגוי", "שאלת פרט"; "נכון!" keeps its "!")
 *  3. any other " — " touching Hebrew → a sentence break ". " (or nothing,
 *     when the left side already ends in punctuation)
 *  4. "המורה...נקודות" (the gap in a quoted sentence) → "המורה ___ נקודות"
 *  5. "ENG = עברית" opening a sentence → "ENG (עברית)" for a short gloss,
 *     "עברית (ENG)" for an explanation, so Hebrew keeps its reading order
 *
 * It does NOT change wording: "לא נפתר" in this content is subject matter
 * ("the problem remains unsolved"), not feedback about the student. English
 * direction (RTL/LTR) is handled where the text is rendered (RichText's
 * bidi isolation), not by storing invisible marks in the data.
 */

const HEB = /[֐-׿]/;
const DASH = /\s*—\s*/;

/** Labels that head an option analysis or a strategy line. */
const MAX_LABEL_WORDS = 3;
const MAX_LABEL_CHARS = 24;

function hasHebrew(s: string): boolean {
  return HEB.test(s);
}

function tidy(s: string): string {
  return s
    .replace(/[ \t]{2,}/g, ' ')
    .replace(/ ([.,:;!?])/g, '$1')
    .replace(/(?<!\.)([.!?])\.(?!\.)/g, '$1')
    .replace(/:\s*\./g, ':')
    .trim();
}

/** Rule 1: "eng = gloss — reason" at the start of a line (after an optional marker). */
function glossRule(s: string): string {
  return s.replace(
    /^((?:[✅❌]\s*)?(?:נכון!|נכון|שגוי)?\s*)([A-Za-z][A-Za-z '’\-/.]*?) = ([^=—.()]{1,40}?)\s*—\s*/u,
    (_m, prefix: string, eng: string, gloss: string) => {
      const lead = prefix.trim();
      const sep = lead === '' ? '' : lead.endsWith('!') ? ' ' : ': ';
      return `${lead}${sep}${eng.trim()} (${gloss.trim()}): `;
    },
  );
}

/** Rule 2: a short leading label before the first dash. */
function labelRule(s: string): string {
  const m = s.match(/^([^—]*?)\s*—\s*/u);
  if (!m) return s;
  const label = m[1].trim();
  if (!label || label.length > MAX_LABEL_CHARS || /[.:,;?"]/.test(label.replace(/!$/, ''))) return s;
  if (label.split(/\s+/).length > MAX_LABEL_WORDS || !hasHebrew(label)) return s;
  const rest = s.slice(m[0].length);
  if (label.endsWith('!')) return `${label} ${rest}`;
  // Avoid a second colon right away ("נכון: הפסקה אומרת: …").
  return /^[^.]{0,30}:/.test(rest) ? `${label}. ${rest}` : `${label}: ${rest}`;
}

/** Rule 3: remaining dashes that touch Hebrew become sentence breaks. */
function dashRule(s: string): string {
  const parts = s.split(DASH);
  if (parts.length === 1) return s;
  let out = parts[0];
  for (let i = 1; i < parts.length; i++) {
    const left = out.trimEnd();
    const right = parts[i];
    // Decided by the letters right next to the dash: an English aside inside
    // an English quote keeps its dash; anything touching Hebrew breaks.
    const lastLetter = left.match(/[A-Za-z\u0590-\u05FF](?=[^A-Za-z\u0590-\u05FF]*$)/)?.[0] ?? '';
    const firstLetter = right.match(/[A-Za-z\u0590-\u05FF]/)?.[0] ?? '';
    const nearHebrew = hasHebrew(lastLetter) || hasHebrew(firstLetter);
    if (!nearHebrew) {
      out = `${left} — ${right}`;
    } else if (/[.:!?;,]$/.test(left) || left === '') {
      out = `${left} ${right}`;
    } else {
      out = `${left}. ${right}`;
    }
  }
  return out;
}

/** Rule 4: a gap written as "..." between Hebrew words. */
function gapRule(s: string): string {
  return s
    // A one-letter prefix stays attached to the gap: "ל...את" → "ל___ את".
    .replace(/(^|\s)([לבכמהוש])\s*\.\.\.\s*(?=[֐-׿])/g, '$1$2___ ')
    .replace(/([֐-׿])\s*\.\.\.\s*([֐-׿])/g, '$1 ___ $2');
}

/** A gloss short enough to sit in parentheses after the English it translates. */
const MAX_GLOSS_WORDS = 4;

/**
 * Rule 5: "ENG = עברית" at the start of a sentence. In RTL the English run
 * opens the line and pushes the Hebrew into a broken reading order, so:
 *  - a short gloss becomes "ENG (עברית)"            ("abandon (לנטוש).")
 *  - an explanation becomes "עברית (ENG)"           (Hebrew leads, English is the aside)
 * Only when the right side is pure Hebrew; English on both sides is left alone.
 */
function equalsRule(s: string): string {
  return s.replace(
    /(^|\. |! |\? |: )((?:נכון! )?)([A-Za-z][A-Za-z0-9 ,'’\-/]*?) = ([֐-׿][^A-Za-z.()]*?)(?=\.(?:\s|$)|$)/gu,
    (_m, lead: string, marker: string, eng: string, heb: string) => {
      const english = eng.trim();
      const hebrew = heb.trim();
      if (hebrew.split(/\s+/).length <= MAX_GLOSS_WORDS) return `${lead}${marker}${english} (${hebrew})`;
      // "parallel = מקביל, מתאים ל…" / "… = לחשוף; המונח…": a gloss followed by its reason.
      const comma = hebrew.search(/[,;]/);
      if (comma > 0 && hebrew.slice(0, comma).trim().split(/\s+/).length <= MAX_GLOSS_WORDS) {
        return `${lead}${marker}${english} (${hebrew.slice(0, comma).trim()}): ${hebrew.slice(comma + 1).trim()}`;
      }
      return `${lead}${marker}${hebrew} (${english})`;
    },
  );
}

export function polishHebrew(text: string): string {
  if (!text || !hasHebrew(text)) return text;
  return tidy(equalsRule(gapRule(dashRule(labelRule(glossRule(text))))));
}

export interface Explanation {
  correct_reason: string;
  options_analysis: string[];
  strategy: string;
  [key: string]: unknown;
}

/** Polishes an explanation JSON string. Returns null if it can't be parsed as the expected shape. */
export function polishExplanationJson(raw: string): string | null {
  let parsed: Explanation;
  try {
    parsed = JSON.parse(raw) as Explanation;
  } catch {
    return null;
  }
  if (typeof parsed?.correct_reason !== 'string' || !Array.isArray(parsed.options_analysis)) return null;
  const next: Explanation = {
    ...parsed,
    correct_reason: polishHebrew(parsed.correct_reason),
    options_analysis: parsed.options_analysis.map(o => (typeof o === 'string' ? polishHebrew(o) : o)),
    strategy: typeof parsed.strategy === 'string' ? polishHebrew(parsed.strategy) : parsed.strategy,
  };
  return JSON.stringify(next);
}
