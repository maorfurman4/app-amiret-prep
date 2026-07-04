export type QuestionType = 'sentence_completion' | 'restatement' | 'reading_comprehension' | 'esra';
export type DifficultyLevel = 1 | 2 | 3 | 4 | 5;
export type ExamMode = 'full' | 'practice' | 'section' | 'esra';

export interface IrtParams {
  a: number; // discrimination
  b: number; // difficulty (-3 to 3)
  c: number; // guessing (~0.25)
}

export interface Option {
  id: string;
  text: string;
}

export interface Passage {
  id: string;
  text: string;
  difficulty_level: DifficultyLevel;
  b: number;
}

export interface Question {
  id: string;
  type: QuestionType;
  text: string;
  passage?: Passage;
  passage_id?: string;
  options: Option[];
  correct_answer: number; // index 0-3
  explanation?: string;
  a: number;
  b: number;
  c: number;
  difficulty_level: DifficultyLevel;
}

export interface SectionConfig {
  index: number;            // 1-7
  type: QuestionType;
  questionCount: number;
  durationSeconds: number;
  // Like the real AMIRNET pilot section: wrong answers never lower the
  // final score, but correct answers can raise it.
  experimental?: boolean;
}

export const SECTION_CONFIGS: SectionConfig[] = [
  { index: 1, type: 'sentence_completion',    questionCount: 4, durationSeconds: 240 },
  { index: 2, type: 'sentence_completion',    questionCount: 4, durationSeconds: 240 },
  { index: 3, type: 'reading_comprehension',  questionCount: 5, durationSeconds: 900 },
  { index: 4, type: 'restatement',            questionCount: 3, durationSeconds: 360 },
  { index: 5, type: 'restatement',            questionCount: 3, durationSeconds: 360 },
  { index: 6, type: 'sentence_completion',    questionCount: 4, durationSeconds: 240 },
  { index: 7, type: 'sentence_completion',    questionCount: 4, durationSeconds: 240, experimental: true },
];

export function isExperimentalSection(sectionIndex: number): boolean {
  return SECTION_CONFIGS[sectionIndex - 1]?.experimental === true;
}

export interface SectionResult {
  sectionIndex: number;
  type: QuestionType;
  questions: Question[];
  answers: (number | null)[]; // index of chosen option, null = skipped
  thetaBefore: number;
  thetaAfter: number;
  correctCount: number;
  totalCount: number;
}

export interface ExamSession {
  id: string;
  user_id: string;
  mode: ExamMode;
  started_at: string;
  completed_at?: string;
  current_section_index: number;  // 1-6, 7 = done
  current_section_expires_at?: string; // ISO string — server-driven timer
  theta: number;
  theta_history: { after_section: number; theta: number }[];
  theta_final?: number;
  score?: number;
  section_results: SectionResult[];
  is_practice: boolean;
  questions_by_section: Record<number, Question[]>; // pre-loaded
  used_question_ids?: string[];
  used_passage_ids?: string[];
}

export interface ScoreClassification {
  label: string;
  description: string;
  color: string;
}

export const SCORE_CLASSIFICATIONS: ScoreClassification[] = [
  { label: 'פטור מלא', description: 'פטור מקורסי אנגלית', color: 'text-green-600' },
  { label: 'מתקדמים ב\'', description: 'קורס מתקדמים ב\'', color: 'text-blue-600' },
  { label: 'מתקדמים א\'', description: 'קורס מתקדמים א\'', color: 'text-yellow-600' },
  { label: 'בסיסי', description: 'קורס בסיסי', color: 'text-orange-600' },
  { label: 'טרום-בסיסי ב\'', description: 'קורס טרום-בסיסי ב\'', color: 'text-red-600' },
  { label: 'טרום-בסיסי א\'', description: 'קורס טרום-בסיסי א\'', color: 'text-red-700' },
];

export function classifyScore(score: number): ScoreClassification {
  if (score >= 134) return SCORE_CLASSIFICATIONS[0];
  if (score >= 120) return SCORE_CLASSIFICATIONS[1];
  if (score >= 100) return SCORE_CLASSIFICATIONS[2];
  if (score >= 85)  return SCORE_CLASSIFICATIONS[3];
  if (score >= 70)  return SCORE_CLASSIFICATIONS[4];
  return SCORE_CLASSIFICATIONS[5];
}
