'use client';

import { use, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { PenLine, RotateCcw, BookOpen, FileText } from 'lucide-react';
import { ExamReview } from '@/components/exam/ExamReview';
import type { Question } from '@/types/exam';
import { authFetch } from '@/lib/auth-fetch';
import { ErrorCauseTagger } from '@/components/exam/ErrorCauseTagger';
import type { ErrorCause } from '@/lib/error-cause';

interface ReviewQuestion extends Question {
  sectionIndex: number;
  sectionType: string;
}

interface SectionBreak {
  sectionIndex: number;
  startAt: number;
  label: string;
}

interface ReviewData {
  questions: ReviewQuestion[];
  selectedAnswers: (number | null)[];
  sectionBreaks: SectionBreak[];
  /** Per item id: latency and any error-cause tag already given. */
  responses?: Record<string, { latencyMs: number | null; errorCause: ErrorCause | null }>;
}

const TYPE_ICONS: Record<string, typeof PenLine> = {
  sentence_completion: PenLine,
  restatement: RotateCcw,
  reading_comprehension: BookOpen,
};

export default function ReviewPage({ params }: { params: Promise<{ sessionId: string }> }) {
  const { sessionId } = use(params);
  const router = useRouter();
  const [data, setData] = useState<ReviewData | null>(null);
  const [fetchError, setFetchError] = useState(false);
  const [loadToken, setLoadToken] = useState(0);

  useEffect(() => {
    let cancelled = false;
    const guestId = localStorage.getItem('amiret_guest_id') ?? '';
    authFetch(`/api/exam/review?sessionId=${sessionId}&guestId=${encodeURIComponent(guestId)}`)
      .then(r => { if (!r.ok) throw new Error('fetch failed'); return r.json(); })
      .then((d: ReviewData) => { if (!cancelled) setData(d); })
      .catch(() => { if (!cancelled) setFetchError(true); });
    return () => { cancelled = true; };
  }, [sessionId, loadToken]);

  if (fetchError) {
    return (
      <main id="main" className="min-h-dvh flex items-center justify-center bg-exam-paper" dir="rtl">
        <div className="text-center">
          <div className="text-exam-wrong text-xl mb-3">לא הצלחנו לטעון את השאלות</div>
          <button onClick={() => { setFetchError(false); setLoadToken(t => t + 1); }} className="text-exam-accent underline text-sm">נסה שוב</button>
        </div>
      </main>
    );
  }

  if (!data) {
    return (
      <main id="main" className="min-h-dvh flex items-center justify-center bg-exam-paper">
        <div className="text-exam-ink-soft">טוען שאלות...</div>
      </main>
    );
  }

  return (
    <ExamReview
      questions={data.questions}
      selectedAnswers={data.selectedAnswers}
      backLabel="חזרה לתוצאות"
      onBack={() => router.push(`/results/${sessionId}`)}
      noCorrectText="במבחן הזה אין תשובות נכונות. הלימוד האמיתי נמצא בסקירת הטעויות."
      renderMeta={(question, index) => {
        const SectionIcon = TYPE_ICONS[question.sectionType] ?? FileText;
        return (
          <>
            <SectionIcon className="w-3.5 h-3.5" strokeWidth={1.75} aria-hidden />
            <span>פרק {question.sectionIndex}</span>
            <span>·</span>
            <span>שאלה {index + 1} מתוך {data.questions.length}</span>
          </>
        );
      }}
      renderWrongExtra={question => (
        <ErrorCauseTagger
          key={question.id}
          target={{ sessionId, itemId: question.id }}
          questionType={question.type}
          latencyMs={data.responses?.[question.id]?.latencyMs}
          initialCause={data.responses?.[question.id]?.errorCause ?? null}
        />
      )}
    />
  );
}
