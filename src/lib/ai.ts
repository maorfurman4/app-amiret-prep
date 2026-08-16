import OpenAI from 'openai';
import type { QuestionType, DifficultyLevel } from '@/types/exam';

// Lazy init — prevents build failure when OPENAI_API_KEY is not set
function getOpenAI() {
  return new OpenAI({ apiKey: process.env.OPENAI_API_KEY ?? 'placeholder' });
}

interface GeneratedQuestion {
  text: string;
  options: { id: string; text: string }[];
  correct_answer: number;
  explanation: string;
  a: number;
  b: number;
  c: number;
  difficulty_level: DifficultyLevel;
}

const DIFFICULTY_B: Record<DifficultyLevel, number> = {
  1: -2.0,
  2: -1.0,
  3:  0.0,
  4:  1.0,
  5:  2.0,
};

const TYPE_PROMPTS: Record<QuestionType, string> = {
  sentence_completion: `Generate an English sentence completion question as used in the AMIRET exam by MALU.
The sentence must have a blank (____) completed by choosing 1 of 4 options.
Test academic English vocabulary, grammar, and logic. ALL text must be in English.`,

  restatement: `Generate an English restatement question as used in the AMIRET exam by MALU.
Provide one English sentence, then 4 options — the student identifies which option expresses the same meaning.
Test comprehension of complex English phrasing. ALL text must be in English.`,

  reading_comprehension: `Generate an English reading comprehension question for the AMIRET exam.
The question is based on a provided passage (do NOT include the passage in the question text — it will be linked separately).
Test the student's ability to identify main ideas, inferences, and vocabulary in context. ALL text must be in English.`,

  esra: `Generate an English reading comprehension or vocabulary question for the AMIRET exam.
Test English reading comprehension, vocabulary in context, or sentence completion. ALL text must be in English.`,
};

/**
 * Generate N questions of a given type and difficulty for admin bulk seeding.
 * NOT called during live exams.
 */
export async function generateQuestions(
  type: QuestionType,
  difficulty: DifficultyLevel,
  count: number = 5,
  passageText?: string, // for reading_comprehension
): Promise<GeneratedQuestion[]> {
  const b = DIFFICULTY_B[difficulty];
  const a = 1.0 + Math.random() * 0.8; // 1.0–1.8
  const c = type === 'esra' ? 0.25 : 0.25;

  const passageContext = passageText
    ? `\n\nThe questions should relate to this passage:\n"""\n${passageText}\n"""`
    : '';

  const prompt = `${TYPE_PROMPTS[type]}${passageContext}

Difficulty level: ${difficulty}/5 (IRT difficulty b ≈ ${b})
Generate exactly ${count} questions.

Return a JSON array where each element has:
{
  "text": "the question text in the appropriate language",
  "options": [
    {"id": "a", "text": "option A"},
    {"id": "b", "text": "option B"},
    {"id": "c", "text": "option C"},
    {"id": "d", "text": "option D"}
  ],
  "correct_answer": 0, // 0-indexed (0=a, 1=b, 2=c, 3=d)
  "explanation": "a JSON string (escaped) with this exact shape: {\\"correct_reason\\": \\"...\\", \\"options_analysis\\": [\\"...\\", \\"...\\", \\"...\\", \\"...\\"], \\"strategy\\": \\"...\\"}"
}

The "explanation" field must itself be a JSON-encoded string matching this structure:
- "correct_reason": in Hebrew, why the correct option is right — translate the key English word/phrase and explain the logic.
- "options_analysis": exactly 4 Hebrew strings, one per option in order (a, b, c, d). For the correct option, start with "נכון! " then the reason. For each wrong option, translate its key word and explain specifically why it fails (contradicts the passage/logic, wrong tone, wrong grammar, too extreme, etc.) — not just "incorrect".
- "strategy": in Hebrew, a short transferable tip — the general technique that would lead to the answer even without knowing the specific vocabulary (e.g. a connector word's logic, a grammar pattern, or a process-of-elimination cue).

IMPORTANT:
- All Hebrew text must be grammatically correct Modern Israeli Hebrew
- Questions must be original and not from any known textbook
- The correct answer should not be predictable by position (vary it)
- Distractors must be plausible
- Return ONLY valid JSON, no markdown`;

  const response = await getOpenAI().chat.completions.create({
    model: 'gpt-4o',
    messages: [
      { role: 'system', content: 'You are an expert in Israeli academic entrance exams, specifically the AMIRET (אמירנ"ט) exam by MALU. You generate high-quality practice questions.' },
      { role: 'user', content: prompt },
    ],
    response_format: { type: 'json_object' },
    temperature: 0.8,
  });

  const raw = response.choices[0].message.content ?? '{"questions":[]}';
  let parsed: { questions?: GeneratedQuestion[] };
  try {
    parsed = JSON.parse(raw);
  } catch {
    parsed = { questions: [] };
  }

  const questions = (Array.isArray(parsed) ? parsed : parsed.questions ?? []) as GeneratedQuestion[];

  return questions.slice(0, count).map(q => ({
    ...q,
    a,
    b,
    c,
    difficulty_level: difficulty,
  }));
}

/**
 * Generate a reading passage for Section 3 at a given difficulty.
 */
export async function generatePassage(difficulty: DifficultyLevel): Promise<{ text: string; b: number }> {
  const b = DIFFICULTY_B[difficulty];
  const lengthGuide = difficulty <= 2 ? '150-200' : difficulty <= 3 ? '200-280' : '280-380';

  const prompt = `Write an English reading comprehension passage for the AMIRET exam (the Israeli university English placement test).
Difficulty: ${difficulty}/5. Length: ${lengthGuide} words.
The passage should be on an academic topic (science, society, history, technology, environment, or culture).
It must be factual, well-structured, original, and not reference any copyrighted material.
Return ONLY the passage text in English, no markdown, no title.`;

  const response = await getOpenAI().chat.completions.create({
    model: 'gpt-4o',
    messages: [{ role: 'user', content: prompt }],
    temperature: 0.7,
  });

  return {
    text: response.choices[0].message.content?.trim() ?? '',
    b,
  };
}

/**
 * Generate personalized post-exam explanations for mistakes.
 * Called ONLY on the /results page, never during an active exam.
 */
export async function generateMistakeExplanations(
  mistakes: Array<{
    questionText: string;
    type: QuestionType;
    userAnswer: string;
    correctAnswer: string;
    options: string[];
  }>
): Promise<string> {
  if (mistakes.length === 0) return '';

  const mistakeList = mistakes.map((m, i) =>
    `שאלה ${i + 1} (${m.type}):\nטקסט: ${m.questionText}\nתשובת המשתמש: ${m.userAnswer}\nתשובה נכונה: ${m.correctAnswer}`
  ).join('\n\n');

  const prompt = `אתה מורה מנוסה למבחן האמירנ"ט. המשתמש טעה בשאלות הבאות:

${mistakeList}

לכל שאלה, ספק:
1. הסבר קצר (2-3 משפטים) מדוע התשובה הנכונה נכונה
2. טיפ מעשי כיצד לזהות שאלות מהסוג הזה בעתיד

כתוב בעברית, בצורה ברורה ומעודדת. אל תחזור על טקסט השאלה המלא.`;

  const response = await getOpenAI().chat.completions.create({
    model: 'gpt-4o',
    messages: [{ role: 'user', content: prompt }],
    temperature: 0.5,
    max_tokens: 1500,
  });

  return response.choices[0].message.content?.trim() ?? '';
}
