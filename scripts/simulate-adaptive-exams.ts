/**
 * Isolated adaptive-exam simulation (NOT part of the app or its test suite).
 *
 * Simulates 100 full 7-section exams end-to-end, driving the REAL,
 * unmodified production adaptive engine (src/lib/adaptive.ts) with the
 * exact same section-by-section orchestration as
 * src/app/api/exam/answer/route.ts (cumulative MLE re-estimation each
 * section, next-section difficulty routing, and the "experimental section
 * can only raise the score, by at most 2 points" final-scoring rule).
 *
 * No database, no Next.js server, no network — every "question" is a
 * synthetic 3PL item whose (a, b, c) parameters are sampled from the real
 * production question bank's per-difficulty-level distribution (queried
 * once, read-only, from Supabase; see the CALIBRATION constant below).
 *
 * Virtual users span the full skill spectrum:
 *   - 1 user who always answers wrong, regardless of the question.
 *   - 1 user who always answers correctly, regardless of the question.
 *   - 98 users with a true IRT ability (theta_true) spread across
 *     [-3.5, 3.5], each answering probabilistically per the 3PL model
 *     (P(correct) = irtProbability(theta_true, item)).
 *
 * Usage: npx tsx scripts/simulate-adaptive-exams.ts
 *
 * This script is intentionally kept outside src/ (which tsconfig.json
 * already excludes from the app's TS project, same as the other one-off
 * tools in this directory) — it does not touch, import into, or get
 * bundled with the production app in any way.
 */
import {
  irtProbability,
  updateThetaAfterSection,
  routeNextDifficulty,
  thetaToScore,
} from '../src/lib/adaptive';
import { SECTION_CONFIGS, isExperimentalSection, type Question, type DifficultyLevel } from '../src/types/exam';

// ── Deterministic RNG (mulberry32) — reproducible runs ──────────────────────

function mulberry32(seed: number) {
  let a = seed;
  return function rng() {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function gaussian(rng: () => number, mean: number, sd: number): number {
  // Box-Muller
  const u1 = Math.max(rng(), 1e-12);
  const u2 = rng();
  const z = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
  return mean + z * sd;
}

const SEED = 20260922;
const rng = mulberry32(SEED);

// ── Item bank calibration — sampled from the real production `questions`
//    table (avg/stddev of a, b per difficulty_level; c is a flat 0.25
//    across every level in production) via a read-only SQL query. ────────

const CALIBRATION: Record<DifficultyLevel, { aMean: number; aSd: number; bMean: number; bSd: number; c: number }> = {
  1: { aMean: 1.223, aSd: 0.192, bMean: -2.052, bSd: 0.216, c: 0.25 },
  2: { aMean: 1.348, aSd: 0.187, bMean: -1.116, bSd: 0.374, c: 0.25 },
  3: { aMean: 1.509, aSd: 0.243, bMean: 0.045,  bSd: 0.197, c: 0.25 },
  4: { aMean: 1.763, aSd: 0.366, bMean: 1.043,  bSd: 0.274, c: 0.25 },
  5: { aMean: 2.087, aSd: 0.391, bMean: 2.002,  bSd: 0.225, c: 0.25 },
};

function makeQuestion(level: DifficultyLevel, idx: number): Question {
  const cal = CALIBRATION[level];
  const a = Math.max(0.4, gaussian(rng, cal.aMean, cal.aSd));
  const b = gaussian(rng, cal.bMean, cal.bSd);
  return {
    id: `sim-${level}-${idx}-${Math.floor(rng() * 1e9)}`,
    type: 'sentence_completion',
    text: 'simulated item',
    options: [{ id: 'a', text: 'a' }, { id: 'b', text: 'b' }, { id: 'c', text: 'c' }, { id: 'd', text: 'd' }],
    correct_answer: 0,
    a, b, c: cal.c,
    difficulty_level: level,
  };
}

// ── Virtual users ────────────────────────────────────────────────────────

type UserMode = 'always_wrong' | 'always_correct' | 'irt';

interface VirtualUser {
  id: number;
  mode: UserMode;
  trueTheta: number; // only meaningful for mode === 'irt'
  label: string;
}

function buildUsers(count: number): VirtualUser[] {
  const users: VirtualUser[] = [];
  users.push({ id: 0, mode: 'always_wrong', trueTheta: -Infinity, label: 'always-wrong' });
  users.push({ id: 1, mode: 'always_correct', trueTheta: Infinity, label: 'always-correct' });

  const irtCount = count - users.length;
  for (let i = 0; i < irtCount; i++) {
    // Evenly spread true ability across a slightly wider range than the
    // model's own [-3, 3] clamp, so we also see how it handles students
    // whose true ability lies outside the estimable range.
    const trueTheta = -3.5 + (7 * i) / (irtCount - 1);
    users.push({ id: users.length, mode: 'irt', trueTheta, label: `theta=${trueTheta.toFixed(2)}` });
  }
  return users;
}

function answerQuestion(user: VirtualUser, item: Question): boolean {
  if (user.mode === 'always_wrong') return false;
  if (user.mode === 'always_correct') return true;
  const p = irtProbability(user.trueTheta, { a: item.a, b: item.b, c: item.c });
  return rng() < p;
}

// ── Full-exam simulation (mirrors src/app/api/exam/answer/route.ts) ────────

interface SectionRecord { sectionIndex: number; questions: Question[]; answers: (number | null)[]; }

interface ExamOutcome {
  user: VirtualUser;
  score: number;
  thetaFinal: number;
  difficultyHistory: DifficultyLevel[]; // difficulty ASSIGNED to each section (index 0 = section 1's, always 3)
  correctPerSection: number[];
}

function simulateExam(user: VirtualUser): ExamOutcome {
  let theta = 0;
  let difficulty: DifficultyLevel = routeNextDifficulty(theta); // = 3, matches /api/exam/start
  const previousResults: SectionRecord[] = [];
  const difficultyHistory: DifficultyLevel[] = [];
  const correctPerSection: number[] = [];
  let finalTheta = 0;
  let finalScore = 100;

  for (let sectionIndex = 1; sectionIndex <= SECTION_CONFIGS.length; sectionIndex++) {
    const cfg = SECTION_CONFIGS[sectionIndex - 1];
    difficultyHistory.push(difficulty);

    const questions = Array.from({ length: cfg.questionCount }, (_, i) => makeQuestion(difficulty, i));
    const answers: (number | null)[] = questions.map(q => (answerQuestion(user, q) ? q.correct_answer : (q.correct_answer + 1) % 4));
    const correct = answers.filter((ans, i) => ans === questions[i].correct_answer).length;
    correctPerSection.push(correct);

    const allQuestions = [...previousResults.flatMap(r => r.questions), ...questions];
    const allAnswers = [...previousResults.flatMap(r => r.answers), ...answers];
    const newTheta = updateThetaAfterSection(theta, { questions: allQuestions, answers: allAnswers });

    const result: SectionRecord = { sectionIndex, questions, answers };
    const isLast = sectionIndex === SECTION_CONFIGS.length;

    if (isLast) {
      const allResults = [...previousResults, result];
      const scoredResults = allResults.filter(r => !isExperimentalSection(r.sectionIndex));
      const baseTheta = updateThetaAfterSection(theta, {
        questions: scoredResults.flatMap(r => r.questions),
        answers: scoredResults.flatMap(r => r.answers),
      });
      const baseScore = thetaToScore(baseTheta);
      const scoreWithExperimental = Math.min(thetaToScore(newTheta), baseScore + 2);
      const finalIsExperimental = scoreWithExperimental > baseScore;
      finalTheta = finalIsExperimental ? newTheta : baseTheta;
      finalScore = Math.max(baseScore, scoreWithExperimental);
    } else {
      theta = newTheta;
      previousResults.push(result);
      difficulty = routeNextDifficulty(newTheta);
    }
  }

  return { user, score: finalScore, thetaFinal: finalTheta, difficultyHistory, correctPerSection };
}

// ── Statistics helpers ───────────────────────────────────────────────────

function mean(xs: number[]): number { return xs.reduce((a, b) => a + b, 0) / xs.length; }
function stddev(xs: number[]): number {
  const m = mean(xs);
  return Math.sqrt(mean(xs.map(x => (x - m) ** 2)));
}
function median(xs: number[]): number {
  const s = [...xs].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
}
function pearsonCorrelation(xs: number[], ys: number[]): number {
  const mx = mean(xs), my = mean(ys);
  const cov = mean(xs.map((x, i) => (x - mx) * (ys[i] - my)));
  const sx = stddev(xs), sy = stddev(ys);
  return sx === 0 || sy === 0 ? 0 : cov / (sx * sy);
}

// ── Run ──────────────────────────────────────────────────────────────────

function main() {
  const NUM_USERS = 100;
  const users = buildUsers(NUM_USERS);
  const outcomes = users.map(simulateExam);

  const scores = outcomes.map(o => o.score);
  const irtOutcomes = outcomes.filter(o => o.user.mode === 'irt');
  const alwaysWrong = outcomes.find(o => o.user.mode === 'always_wrong')!;
  const alwaysCorrect = outcomes.find(o => o.user.mode === 'always_correct')!;

  console.log('='.repeat(78));
  console.log(`ADAPTIVE EXAM SIMULATION — ${NUM_USERS} virtual users, seed=${SEED}`);
  console.log('='.repeat(78));

  // ── 1. Score range coverage ────────────────────────────────────────────
  console.log('\n--- 1. Score distribution (target range: 50-150) ---');
  console.log(`  min:    ${Math.min(...scores)}`);
  console.log(`  max:    ${Math.max(...scores)}`);
  console.log(`  mean:   ${mean(scores).toFixed(1)}`);
  console.log(`  median: ${median(scores)}`);
  console.log(`  stddev: ${stddev(scores).toFixed(1)}`);

  const buckets = [50, 60, 70, 80, 90, 100, 110, 120, 130, 140, 150];
  console.log('\n  Histogram (10-point buckets):');
  for (let i = 0; i < buckets.length - 1; i++) {
    const lo = buckets[i], hi = buckets[i + 1];
    const count = scores.filter(s => s >= lo && (i === buckets.length - 2 ? s <= hi : s < hi)).length;
    console.log(`    [${lo}-${hi}${i === buckets.length - 2 ? ']' : ')'}: ${'#'.repeat(count)} (${count})`);
  }

  console.log(`\n  always-wrong user   -> score ${alwaysWrong.score} (theta_final=${alwaysWrong.thetaFinal.toFixed(3)})`);
  console.log(`  always-correct user -> score ${alwaysCorrect.score} (theta_final=${alwaysCorrect.thetaFinal.toFixed(3)})`);

  // ── 2. Adaptivity: does difficulty track ability? ──────────────────────
  console.log('\n--- 2. Adaptive difficulty routing ---');
  const trueThetas = irtOutcomes.map(o => o.user.trueTheta);
  const avgDifficulty = irtOutcomes.map(o => mean(o.difficultyHistory));
  const lastSectionDifficulty = irtOutcomes.map(o => o.difficultyHistory[o.difficultyHistory.length - 1]);
  const corrAvg = pearsonCorrelation(trueThetas, avgDifficulty);
  const corrLast = pearsonCorrelation(trueThetas, lastSectionDifficulty);
  console.log(`  Pearson correlation(true ability, avg section difficulty): ${corrAvg.toFixed(3)}`);
  console.log(`  Pearson correlation(true ability, section-7 difficulty):   ${corrLast.toFixed(3)}`);

  const sortedByTheta = [...irtOutcomes].sort((a, b) => a.user.trueTheta - b.user.trueTheta);
  const q = Math.floor(sortedByTheta.length / 4);
  const bottomQuartile = sortedByTheta.slice(0, q);
  const topQuartile = sortedByTheta.slice(-q);
  const bottomAvgLastDiff = mean(bottomQuartile.map(o => o.difficultyHistory[o.difficultyHistory.length - 1]));
  const topAvgLastDiff = mean(topQuartile.map(o => o.difficultyHistory[o.difficultyHistory.length - 1]));
  console.log(`\n  Bottom-quartile ability (n=${bottomQuartile.length}): avg section-7 difficulty = ${bottomAvgLastDiff.toFixed(2)}`);
  console.log(`  Top-quartile ability    (n=${topQuartile.length}): avg section-7 difficulty = ${topAvgLastDiff.toFixed(2)}`);

  console.log('\n  Difficulty trajectory (section 1 -> 7) for 5 representative users:');
  const sampleIdx = [0, Math.floor(irtOutcomes.length * 0.25), Math.floor(irtOutcomes.length * 0.5), Math.floor(irtOutcomes.length * 0.75), irtOutcomes.length - 1];
  for (const i of sampleIdx) {
    const o = sortedByTheta[i];
    console.log(`    theta_true=${o.user.trueTheta.toFixed(2).padStart(6)}: [${o.difficultyHistory.join(' -> ')}]  score=${o.score}`);
  }
  console.log(`    always-wrong:        [${alwaysWrong.difficultyHistory.join(' -> ')}]  score=${alwaysWrong.score}`);
  console.log(`    always-correct:      [${alwaysCorrect.difficultyHistory.join(' -> ')}]  score=${alwaysCorrect.score}`);

  // ── 3. Ability -> score fidelity ────────────────────────────────────────
  console.log('\n--- 3. Ability-to-score fidelity ---');
  const irtScores = irtOutcomes.map(o => o.score);
  const corrScore = pearsonCorrelation(trueThetas, irtScores);
  console.log(`  Pearson correlation(true ability, final score): ${corrScore.toFixed(3)}`);

  // ── Pass/fail checks ─────────────────────────────────────────────────
  console.log('\n--- Checks ---');
  const checks: { name: string; pass: boolean; detail: string }[] = [];
  checks.push({ name: 'All scores within [50, 150]', pass: scores.every(s => s >= 50 && s <= 150), detail: `min=${Math.min(...scores)} max=${Math.max(...scores)}` });
  checks.push({ name: 'always-wrong user scores at/near the 50 floor', pass: alwaysWrong.score <= 55, detail: `score=${alwaysWrong.score}` });
  checks.push({ name: 'always-correct user scores at/near the 150 ceiling', pass: alwaysCorrect.score >= 145, detail: `score=${alwaysCorrect.score}` });
  checks.push({ name: 'Score range spans at least 80 points across varying-skill users', pass: (Math.max(...irtScores) - Math.min(...irtScores)) >= 80, detail: `spread=${Math.max(...irtScores) - Math.min(...irtScores)}` });
  checks.push({ name: 'Ability strongly predicts score (corr > 0.85)', pass: corrScore > 0.85, detail: `corr=${corrScore.toFixed(3)}` });
  checks.push({ name: 'Ability strongly predicts assigned difficulty (corr > 0.7)', pass: corrAvg > 0.7, detail: `corr=${corrAvg.toFixed(3)}` });
  checks.push({ name: 'Low-ability quartile gets easier section-7 items than high-ability quartile', pass: (topAvgLastDiff - bottomAvgLastDiff) >= 1.5, detail: `bottom=${bottomAvgLastDiff.toFixed(2)} top=${topAvgLastDiff.toFixed(2)}` });

  let allPass = true;
  for (const c of checks) {
    console.log(`  [${c.pass ? 'PASS' : 'FAIL'}] ${c.name} (${c.detail})`);
    if (!c.pass) allPass = false;
  }

  console.log('\n' + '='.repeat(78));
  console.log(allPass ? 'RESULT: ALL CHECKS PASSED' : 'RESULT: SOME CHECKS FAILED');
  console.log('='.repeat(78));

  process.exitCode = allPass ? 0 : 1;
}

main();
