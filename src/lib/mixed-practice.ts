/**
 * Mixed-type practice: how many of each question type a session holds, and
 * the order they're served in. Pure (no I/O) so the picker and the API share
 * one definition and the ordering is unit-testable.
 *
 * Every exam-derived number here is read off SECTION_CONFIGS (the app's own
 * AMIRNET spec) rather than restated — only MIXED_LIMITS are app choices.
 */
import { SECTION_CONFIGS, type QuestionType } from '@/types/exam';

/** sc/rs = single questions; rc = reading-comprehension passages (whole blocks). */
export interface MixedPlan { sc: number; rs: number; rc: number }

export type MixedTypeKey = keyof MixedPlan;

export const MIXED_TYPE: Record<MixedTypeKey, QuestionType> = {
  sc: 'sentence_completion',
  rs: 'restatement',
  rc: 'reading_comprehension',
};

const coreSections = SECTION_CONFIGS.filter(s => !s.experimental);
const sectionsOf = (type: QuestionType) => coreSections.filter(s => s.type === type);

/** Questions per reading passage, as in the exam's RC section. */
export const RC_PER_PASSAGE = sectionsOf('reading_comprehension')[0]?.questionCount ?? 5;

/** Seconds per question (or per passage) at the exam's own section pace. */
const SECONDS_PER: MixedPlan = {
  sc: perItemSeconds('sentence_completion'),
  rs: perItemSeconds('restatement'),
  rc: sectionsOf('reading_comprehension')[0]?.durationSeconds ?? 0,
};

function perItemSeconds(type: QuestionType): number {
  const s = sectionsOf(type)[0];
  return s ? s.durationSeconds / s.questionCount : 0;
}

/** The scored part of the real exam: 12 SC, 6 restatement, 1 passage. */
export const EXAM_MIX: MixedPlan = {
  sc: sectionsOf('sentence_completion').reduce((n, s) => n + s.questionCount, 0),
  rs: sectionsOf('restatement').reduce((n, s) => n + s.questionCount, 0),
  rc: sectionsOf('reading_comprehension').length,
};

/** The exam mix scaled down; a passage can't be split, so it never drops below one. */
function scaled(divisor: number): MixedPlan {
  return {
    sc: Math.round(EXAM_MIX.sc / divisor),
    rs: Math.round(EXAM_MIX.rs / divisor),
    rc: EXAM_MIX.rc > 0 ? Math.max(1, Math.round(EXAM_MIX.rc / divisor)) : 0,
  };
}

export const MIXED_PRESETS: { id: 'full' | 'half' | 'short'; label: string; plan: MixedPlan }[] = [
  { id: 'full', label: 'מבנה מבחן מלא', plan: EXAM_MIX },
  { id: 'half', label: 'חצי מבחן', plan: scaled(2) },
  { id: 'short', label: 'קצר', plan: scaled(3) },
];

export const MIXED_DEFAULT: MixedPlan = scaled(2);

/**
 * App guardrails, NOT exam facts: they keep one practice session (and its
 * fetch) a sane size.
 */
export const MIXED_LIMITS: MixedPlan & { total: number } = { sc: 12, rs: 12, rc: 2, total: 30 };

export function planQuestionCount(plan: MixedPlan): number {
  return plan.sc + plan.rs + plan.rc * RC_PER_PASSAGE;
}

/** Whole minutes the plan would take at the exam's own pace. */
export function planMinutes(plan: MixedPlan): number {
  return Math.round((plan.sc * SECONDS_PER.sc + plan.rs * SECONDS_PER.rs + plan.rc * SECONDS_PER.rc) / 60);
}

export function samePlan(a: MixedPlan, b: MixedPlan): boolean {
  return a.sc === b.sc && a.rs === b.rs && a.rc === b.rc;
}

/** Whether the plan is within MIXED_LIMITS and has at least one question. */
export function planIsValid(plan: MixedPlan): boolean {
  const total = planQuestionCount(plan);
  return total > 0 && total <= MIXED_LIMITS.total
    && (['sc', 'rs', 'rc'] as const).every(k => Number.isInteger(plan[k]) && plan[k] >= 0 && plan[k] <= MIXED_LIMITS[k]);
}

/**
 * Reads sc/rs/rc from query params. Missing params (an old link, or a caller
 * that never knew about them) fall back to MIXED_DEFAULT; each value is
 * clamped to its limit. Returns null when the result is empty or over the
 * total cap — the caller should reject the request.
 */
export function parseMixedPlan(params: URLSearchParams): MixedPlan | null {
  if (!['sc', 'rs', 'rc'].some(k => params.has(k))) return { ...MIXED_DEFAULT };
  const read = (k: MixedTypeKey) => {
    const n = parseInt(params.get(k) ?? '0', 10);
    return Number.isFinite(n) ? Math.max(0, Math.min(MIXED_LIMITS[k], n)) : 0;
  };
  const plan = { sc: read('sc'), rs: read('rs'), rc: read('rc') };
  return planIsValid(plan) ? plan : null;
}

/**
 * Serves singles and passages in one realistic order:
 * - SC and restatement are spread so their ratio holds all the way through
 *   (no long run of one type), with random tie-breaks;
 * - each passage stays one contiguous block, its questions in their given
 *   order, and the blocks are spaced evenly toward the middle of the session
 *   (one passage lands mid-session, roughly where RC sits in the exam).
 */
export function interleaveMixed<T>(sc: T[], rs: T[], passages: T[][], random: () => number = Math.random): T[] {
  const singles: T[] = [];
  let i = 0;
  let j = 0;
  while (i < sc.length || j < rs.length) {
    // Each list's next item has an ideal slot — the midpoint of its share of
    // the session, as a fraction; serve whichever is due first.
    const scSlot = i < sc.length ? (i + 0.5) / sc.length : Infinity;
    const rsSlot = j < rs.length ? (j + 0.5) / rs.length : Infinity;
    const takeSc = scSlot < rsSlot || (scSlot === rsSlot && random() < 0.5);
    if (takeSc) singles.push(sc[i++]);
    else singles.push(rs[j++]);
  }

  const blocks = passages.filter(p => p.length > 0);
  const out = [...singles];
  // Insert from the last slot backwards so earlier positions stay valid.
  for (let k = blocks.length; k >= 1; k--) {
    const at = Math.round((singles.length * k) / (blocks.length + 1));
    out.splice(at, 0, ...blocks[k - 1]);
  }
  return out;
}
