'use client';

/**
 * Dev-only results screen with a generated finished exam, for design review:
 * the real ResultsView, with no network reads or writes (the streak,
 * official-score prompt and sign-in slot is left empty).
 * ?state=below (default) | near | pass | practice | legacy.
 */

import { useSearchParams } from 'next/navigation';
import { Suspense } from 'react';
import { SECTION_CONFIGS } from '@/types/exam';
import { ResultsView, type ResultsSession } from '@/components/results/ResultsView';

interface Seed {
  score: number;
  /** Share answered right in each scored section. */
  rate: number;
  /** Seconds per question. */
  seconds: number;
  isPractice?: boolean;
  /** Old exams: no stored SE, no routing targets, no timings. */
  legacy?: boolean;
  /** Sections 5–6 aimed at the 134 cut. */
  cut?: boolean;
}

const SEEDS: Record<string, Seed> = {
  below: { score: 118, rate: 0.62, seconds: 70 },
  near: { score: 133, rate: 0.74, seconds: 80, cut: true },
  pass: { score: 138, rate: 0.82, seconds: 75 },
  practice: { score: 104, rate: 0.5, seconds: 60, isPractice: true },
  legacy: { score: 96, rate: 0.48, seconds: 0, legacy: true },
};

function session(seed: Seed): ResultsSession {
  const theta = (seed.score - 100) / 20;
  const sectionResults = SECTION_CONFIGS.map(cfg => {
    const questions = Array.from({ length: cfg.questionCount }, (_, q) => ({
      id: `${cfg.index}-${q}`, correct_answer: 0, difficulty_level: 1 + ((q + cfg.index * 2) % 5),
    }));
    // Deterministic spread: question q is right when its slot falls under the rate.
    const answers = questions.map((_, q) => (((q * 7 + cfg.index * 3) % 10) / 10 < seed.rate ? 0 : 1));
    // A little spread, with one slow question in section 3 so the pace panel has something to say.
    const timings = questions.map((_, q) => (cfg.index === 3 && q === 1 ? 240 : seed.seconds + q * 4));
    return {
      sectionIndex: cfg.index, type: cfg.type, questions, answers,
      thetaBefore: theta, thetaAfter: theta,
      correctCount: answers.filter(a => a === 0).length, totalCount: questions.length,
      ...(seed.legacy ? {} : { timings }),
    };
  });
  return {
    score: seed.score,
    theta_final: theta,
    theta_se: seed.legacy ? null : 0.35,
    theta_history: seed.legacy ? [] : SECTION_CONFIGS.map(cfg => ({
      after_section: cfg.index, theta, target_theta: theta,
      target_reason: seed.cut && cfg.index >= 4 ? 'cut_score' : 'ability',
    })),
    section_results: sectionResults as ResultsSession['section_results'],
    answers_by_section: {},
    questions_by_section: {},
    is_practice: seed.isPractice ?? false,
    completed_at: new Date().toISOString(),
  };
}

function Preview() {
  const state = useSearchParams().get('state') ?? 'below';
  return <ResultsView key={state} session={session(SEEDS[state] ?? SEEDS.below)} sessionId="preview" />;
}

export function ResultsPreview() {
  return <Suspense><Preview /></Suspense>;
}
