import type { DifficultyLevel, IrtParams } from '@/types/exam';
import { posteriorEAP, routeNextDifficulty, thetaToScore } from '@/lib/adaptive';

/**
 * The onboarding diagnostic: a stateless, item-by-item CAT.
 *
 * Each next item is the most informative one at the current θ̂ (see
 * /api/diagnostic/next), alternating the two question types the diagnostic
 * covers. It stops once the posterior SD of θ reaches TARGET_SD — after at
 * least MIN_ITEMS, at most MAX_ITEMS. With a = 1.2, c = 0.25 an item carries
 * at most ~0.22 information, so the target is typically reached around 8
 * well-targeted items; the cap guards the extremes of the scale, where the
 * item pool is thin and certainty accrues slowly.
 *
 * Reading comprehension is excluded: a passage is served whole (5 items),
 * which would roughly double the length of the flow.
 */
export const DIAGNOSTIC = {
  minItems: 6,
  maxItems: 10,
  targetSd: 0.65,
  /** z for the per-type split test (two-sided 95%). */
  splitZ: 1.96,
} as const;

export const DIAGNOSTIC_TYPES = ['sentence_completion', 'restatement'] as const;
export type DiagnosticType = (typeof DIAGNOSTIC_TYPES)[number];

export interface ScoredItem {
  type: DiagnosticType;
  params: IrtParams;
  correct: boolean;
}

export interface DiagnosticState {
  theta: number;
  sd: number;
  answered: number;
  done: boolean;
  /** 0–1 "certainty" progress for the UI; reaches 1 exactly when done. */
  progress: number;
  /** The type to serve next (meaningless once done). */
  nextType: DiagnosticType;
}

const PRIOR_SD = 1;

export function diagnosticState(items: ScoredItem[]): DiagnosticState {
  const { theta, sd } = posteriorEAP(items.map(i => i.params), items.map(i => (i.correct ? 1 : 0)));
  const answered = items.length;
  const done = answered >= DIAGNOSTIC.maxItems || (answered >= DIAGNOSTIC.minItems && sd <= DIAGNOSTIC.targetSd);

  // Certainty gained so far, from the prior's SD down to the target — with
  // the answered count as a floor so the bar still moves when an answer
  // barely changes the SD. Held below 1 until the stopping rule fires.
  const sdProgress = (PRIOR_SD - sd) / (PRIOR_SD - DIAGNOSTIC.targetSd);
  const progress = done ? 1 : Math.min(0.95, Math.max(0, sdProgress, answered / DIAGNOSTIC.maxItems));

  const count = (t: DiagnosticType) => items.filter(i => i.type === t).length;
  const nextType: DiagnosticType = count('restatement') < count('sentence_completion') ? 'restatement' : 'sentence_completion';

  return { theta, sd, answered, done, progress, nextType };
}

export interface TypeEstimate {
  type: DiagnosticType;
  theta: number;
  sd: number;
  correct: number;
  total: number;
}

export interface TypeSplit {
  byType: TypeEstimate[];
  /** True only when the two types' abilities differ beyond sampling noise. */
  significant: boolean;
}

/**
 * Should the two question types get different starting levels? Each type
 * gets its own EAP estimate (same N(0,1) prior, so a type with few answers
 * is pulled toward the middle), and the gap between them must exceed
 * splitZ standard errors of the difference. With 3–5 items per type that
 * SE is ~1 θ unit, so only a stark contrast splits — anything less is noise
 * and the student gets one unified level.
 */
export function typeSplit(items: ScoredItem[]): TypeSplit {
  const byType: TypeEstimate[] = [];
  for (const type of DIAGNOSTIC_TYPES) {
    const own = items.filter(i => i.type === type);
    if (own.length === 0) continue;
    const { theta, sd } = posteriorEAP(own.map(i => i.params), own.map(i => (i.correct ? 1 : 0)));
    byType.push({ type, theta, sd, correct: own.filter(i => i.correct).length, total: own.length });
  }
  if (byType.length < 2) return { byType, significant: false };
  const [a, b] = byType;
  const seDiff = Math.sqrt(a.sd ** 2 + b.sd ** 2);
  return { byType, significant: Math.abs(a.theta - b.theta) > DIAGNOSTIC.splitZ * seDiff };
}

export interface PracticeStep {
  type: DiagnosticType;
  level: DifficultyLevel;
  href: string;
}

export interface StartPlan {
  theta: number;
  sd: number;
  score: number;
  level: DifficultyLevel;
  /** Levels covered by θ̂ ± 1 SD — the honest uncertainty band. */
  levelRange: [DifficultyLevel, DifficultyLevel];
  split: boolean;
  /** The single "Start here" action. */
  primary: PracticeStep;
  /** The other type, at its own level. */
  secondary: PracticeStep;
  /** Add daily vocabulary work (lower ability band). */
  suggestVocabulary: boolean;
  byType: TypeEstimate[];
}

export function practiceHref(type: DiagnosticType, level: DifficultyLevel): string {
  return `/practice?type=${type}&difficulty=${level}&start=1`;
}

export function buildStartPlan(items: ScoredItem[]): StartPlan {
  const { theta, sd } = diagnosticState(items);
  const level = routeNextDifficulty(theta);
  const { byType, significant } = typeSplit(items);

  const levelOf = (type: DiagnosticType): DifficultyLevel => {
    if (!significant) return level;
    const est = byType.find(e => e.type === type);
    return est ? routeNextDifficulty(est.theta) : level;
  };

  // Unified: start with sentence completion — half of the scored sections.
  // Split: start with the weaker type, where practice pays off most.
  const weaker = significant
    ? [...byType].sort((x, y) => x.theta - y.theta)[0].type
    : 'sentence_completion';
  const other: DiagnosticType = weaker === 'sentence_completion' ? 'restatement' : 'sentence_completion';

  const score = thetaToScore(theta);
  return {
    theta,
    sd,
    score,
    level,
    levelRange: [routeNextDifficulty(theta - sd), routeNextDifficulty(theta + sd)],
    split: significant,
    primary: { type: weaker, level: levelOf(weaker), href: practiceHref(weaker, levelOf(weaker)) },
    secondary: { type: other, level: levelOf(other), href: practiceHref(other, levelOf(other)) },
    suggestVocabulary: score < 100,
    byType,
  };
}
