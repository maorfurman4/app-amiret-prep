'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import Link from 'next/link';
import { BackNav } from '@/components/BackNav';
import { QuestionCard } from '@/components/exam/QuestionCard';
import { authFetch } from '@/lib/auth-fetch';
import { DwellTimer, logResponses, responseEntry } from '@/lib/response-log-client';
import { createClient } from '@/lib/supabase';
import { ensureGuestIdentity } from '@/lib/guest';
import { nextInterval, addDays } from '@/lib/spaced-repetition';
import { isCorrectAnswer, type Question } from '@/types/exam';
import {
  Sparkles, RotateCcw, BookOpen, Target, Volume2, Check, X,
  PartyPopper, ThumbsUp, AlertTriangle, ChevronLeft,
} from 'lucide-react';
import { heCount } from '@/lib/hebrew-count';

interface VocabWord {
  id: string;
  word: string;
  definition: string;
  hebrew_translation: string;
  example_sentence: string;
  category: string;
  difficulty_level: number;
  interval_days: number;
}

interface SessionData {
  reviewQuestions: Question[];
  vocabWords: VocabWord[];
  weakQuestions: Question[];
  weakType: string | null;
  weakLevel: number | null;
  totalItems: number;
}

type Phase = 'loading' | 'error' | 'empty' | 'intro' | 'review' | 'vocab' | 'weak' | 'done';

const TYPE_LABELS: Record<string, string> = {
  sentence_completion: 'השלמת משפטים',
  restatement: 'ניסוח מחדש',
  reading_comprehension: 'הבנת הנקרא',
};

const VOCAB_MAX_INTERVAL_DAYS = 60;

function speak(word: string) {
  if (typeof window === 'undefined') return;
  window.speechSynthesis.cancel();
  const u = new SpeechSynthesisUtterance(word);
  u.lang = 'en-US';
  u.rate = 0.85;
  window.speechSynthesis.speak(u);
}

export default function TodaySessionPage() {
  const supabase = createClient();

  const [phase, setPhase] = useState<Phase>('loading');
  const [data, setData] = useState<SessionData | null>(null);
  const [userId, setUserId] = useState<string | null>(null);

  // Shared per-phase progress
  const [idx, setIdx] = useState(0);
  const [selected, setSelected] = useState<number | null>(null);
  const [showResult, setShowResult] = useState(false);
  const [correctCount, setCorrectCount] = useState(0);
  const [totalAnswered, setTotalAnswered] = useState(0);

  // Vocab sub-phase
  const [flipped, setFlipped] = useState(false);
  const [vocabKnownCount, setVocabKnownCount] = useState(0);

  useEffect(() => {
    ensureGuestIdentity().catch(() => {});
    supabase.auth.getUser().then(({ data: { user } }) => setUserId(user?.id ?? null));
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const load = useCallback(() => {
    authFetch('/api/today-session')
      .then(r => { if (!r.ok) throw new Error(); return r.json(); })
      .then((d: SessionData) => {
        setData(d);
        setPhase(d.totalItems === 0 ? 'empty' : 'intro');
      })
      .catch(() => setPhase('error'));
  }, []);

  useEffect(() => { load(); }, [load]);

  const startSession = () => {
    if (!data) return;
    setIdx(0);
    setSelected(null);
    setShowResult(false);
    setCorrectCount(0);
    setTotalAnswered(0);
    setVocabKnownCount(0);
    if (data.reviewQuestions.length > 0) setPhase('review');
    else if (data.vocabWords.length > 0) setPhase('vocab');
    else if (data.weakQuestions.length > 0) setPhase('weak');
    else setPhase('done');
  };

  // Progress (rings, streak) is recorded server-side from the logged
  // answers themselves — nothing to report here.
  const finishSession = useCallback(() => {
    setPhase('done');
  }, []);

  // ── Question phases (review + weak) ───────────────────────────────────────
  const currentQuestions = phase === 'review' ? data?.reviewQuestions ?? [] : phase === 'weak' ? data?.weakQuestions ?? [] : [];
  const currentQuestion = currentQuestions[idx] ?? null;

  // Per-question time on screen, for the responses log's latency.
  const dwellRef = useRef(new DwellTimer());
  const currentQuestionId = currentQuestion?.id ?? null;
  useEffect(() => { dwellRef.current.focus(currentQuestionId); }, [currentQuestionId]);

  const handleAnswer = (optionIndex: number) => {
    if (selected !== null || !currentQuestion) return;
    setSelected(optionIndex);
    setShowResult(true);
    const correct = isCorrectAnswer(currentQuestion, optionIndex);
    if (correct) setCorrectCount(c => c + 1);
    setTotalAnswered(t => t + 1);
    // Due reviews are review data; fresh weak-area questions are practice.
    // Either way the server feeds the answer to its concept's FSRS card.
    logResponses([responseEntry(currentQuestion, optionIndex, phase === 'review' ? 'review' : 'practice',
      dwellRef.current.elapsedMs(currentQuestion.id))]);
  };

  const nextFromQuestionPhase = () => {
    if (!data) return;
    setSelected(null);
    setShowResult(false);
    if (idx + 1 < currentQuestions.length) {
      setIdx(i => i + 1);
      return;
    }
    if (phase === 'review') {
      setIdx(0);
      if (data.vocabWords.length > 0) setPhase('vocab');
      else if (data.weakQuestions.length > 0) setPhase('weak');
      else finishSession();
    } else if (phase === 'weak') {
      // These were fetched fresh (not over-fetched-and-discarded like the
      // diagnostic), so every one shown here was actually answered —
      // mark exactly that set as seen now, not before.
      if (data.weakQuestions.length > 0) {
        authFetch('/api/practice/questions/mark-seen', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ids: data.weakQuestions.map(q => q.id) }),
        }).catch(() => {});
      }
      finishSession();
    }
  };

  // ── Vocab phase ─────────────────────────────────────────────────────────
  const currentWord = data?.vocabWords[idx] ?? null;

  const markVocab = (knewIt: boolean) => {
    if (!currentWord || !userId) return;
    // A word only reaches this screen because it was already "known" and
    // due for review — confirming it again doubles its actual current
    // interval (not a fixed step), same reset-on-failure the review queue
    // and the vocabulary page's own flashcard flow both use.
    const newInterval = knewIt ? nextInterval(currentWord.interval_days, VOCAB_MAX_INTERVAL_DAYS) : 1;
    const nextReviewAt = addDays(new Date(), newInterval).toISOString();
    if (knewIt) setVocabKnownCount(c => c + 1);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (supabase.from('user_vocab_known') as any)
      .upsert({ user_id: userId, word_id: currentWord.id, interval_days: newInterval, next_review_at: nextReviewAt })
      .then(() => {});
    setFlipped(false);
    if (!data) return;
    if (idx + 1 < data.vocabWords.length) {
      setIdx(i => i + 1);
    } else {
      setIdx(0);
      if (data.weakQuestions.length > 0) setPhase('weak');
      else finishSession();
    }
  };

  // ── Render ──────────────────────────────────────────────────────────────

  if (phase === 'loading') {
    return (
      <div className="min-h-dvh bg-exam-paper flex items-center justify-center" dir="rtl">
        <div className="text-exam-ink-soft">מכין את האימון שלך...</div>
      </div>
    );
  }

  if (phase === 'error') {
    return (
      <div className="min-h-dvh bg-exam-paper flex items-center justify-center px-4" dir="rtl">
        <div className="text-center space-y-4">
          <AlertTriangle className="w-10 h-10 mx-auto text-exam-wrong" strokeWidth={1.5} aria-hidden />
          <p className="text-exam-ink-soft text-sm">לא הצלחנו להכין את האימון. נסה שוב.</p>
          <button onClick={() => { setPhase('loading'); load(); }} className="px-6 py-2.5 bg-exam-accent text-exam-accent-ink rounded-sm font-semibold hover:opacity-90 transition-opacity">
            נסה שוב
          </button>
        </div>
      </div>
    );
  }

  if (phase === 'empty') {
    return (
      <div className="min-h-dvh bg-exam-paper" dir="rtl">
        <BackNav backHref="/" backLabel="דף הבית" />
        <div className="max-w-lg mx-auto px-4 py-16 text-center space-y-4">
          <PartyPopper className="w-14 h-14 mx-auto text-exam-sage-strong" strokeWidth={1.5} aria-hidden />
          <h1 className="text-2xl font-bold text-exam-ink">הכל מעודכן!</h1>
          <p className="text-exam-ink-soft">
            אין כרגע שאלות או מילים לחזרה, ועוד אין מספיק נתונים כדי לזהות נקודת חולשה. תרגל עוד קצת או עשה מבחן, וחזור לכאן.
          </p>
          <div className="flex gap-3 pt-2">
            <Link href="/practice" className="flex-1 py-3 bg-exam-accent text-exam-accent-ink rounded-sm font-semibold text-center hover:opacity-90 transition-opacity">לתרגול ממוקד</Link>
            <Link href="/" className="flex-1 py-3 bg-exam-surface border border-exam-border text-exam-ink rounded-sm font-semibold text-center hover:bg-exam-paper-alt transition-colors">חזרה לדף הבית</Link>
          </div>
        </div>
      </div>
    );
  }

  if (phase === 'intro' && data) {
    const items = [
      data.reviewQuestions.length > 0 && { icon: RotateCcw, label: `${heCount(data.reviewQuestions.length, 'question')} לחזרה`, sub: 'טעויות ישנות שהגיע זמנן' },
      data.vocabWords.length > 0 && { icon: BookOpen, label: `${heCount(data.vocabWords.length, 'word')} לחזרה`, sub: 'מילים שסימנת שאתה יודע, לרענון' },
      data.weakQuestions.length > 0 && { icon: Target, label: `${heCount(data.weakQuestions.length, 'question')} לתרגול ממוקד`, sub: data.weakType ? `${TYPE_LABELS[data.weakType] ?? data.weakType}: נקודת החולשה שלך` : 'תרגול טרי' },
    ].filter(Boolean) as { icon: typeof RotateCcw; label: string; sub: string }[];

    return (
      <div className="min-h-dvh bg-exam-paper" dir="rtl">
        <BackNav backHref="/" backLabel="דף הבית" />
        <div className="max-w-lg mx-auto px-4 py-10">
          <div className="text-center mb-8">
            <Sparkles className="w-12 h-12 mx-auto mb-3 text-exam-accent" strokeWidth={1.5} aria-hidden />
            <h1 className="text-2xl font-bold text-exam-ink">האימון של היום</h1>
            <p className="text-exam-ink-soft text-sm mt-1">מותאם לך: לחיצה אחת, בלי לבחור כלום</p>
          </div>

          <div className="space-y-2.5 mb-8">
            {items.map((item, i) => (
              <div key={i} className="flex items-center gap-3 p-4 bg-exam-surface border border-exam-border rounded-md">
                <item.icon className="w-6 h-6 text-exam-ink-soft flex-shrink-0" strokeWidth={1.75} aria-hidden />
                <div>
                  <div className="font-bold text-exam-ink text-sm">{item.label}</div>
                  <div className="text-exam-ink-soft text-xs mt-0.5">{item.sub}</div>
                </div>
              </div>
            ))}
          </div>

          <button
            onClick={startSession}
            className="w-full py-4 bg-exam-accent text-exam-accent-ink rounded-md text-lg font-bold hover:opacity-90 transition-opacity flex items-center justify-center gap-2"
          >
            התחל <ChevronLeft className="w-5 h-5" aria-hidden />
          </button>
        </div>
      </div>
    );
  }

  if ((phase === 'review' || phase === 'weak') && currentQuestion) {
    const phaseLabel = phase === 'review' ? 'חזרה על טעויות' : 'תרגול ממוקד';
    return (
      <div className="min-h-dvh bg-exam-paper" dir="rtl">
        <div className="sticky top-0 z-10 bg-exam-surface border-b border-exam-border">
          <div className="max-w-2xl mx-auto px-4 py-3 flex items-center justify-between">
            <span className="text-sm font-bold text-exam-ink">{phaseLabel}</span>
            <span className="text-xs text-exam-ink-soft">{idx + 1} / {currentQuestions.length}</span>
          </div>
          <div className="h-1 bg-exam-paper-alt">
            <div className="h-full bg-exam-accent transition-all" style={{ width: `${((idx) / currentQuestions.length) * 100}%` }} />
          </div>
        </div>

        <main className="max-w-2xl mx-auto px-4 py-8">
          <QuestionCard
            question={currentQuestion}
            questionNumber={idx + 1}
            totalInSection={currentQuestions.length}
            selectedAnswer={selected}
            onSelect={handleAnswer}
            isPractice
            showResult={showResult}
            hideHeader
          />
          {showResult && (
            <div className="mt-6 flex justify-start">
              <button
                onClick={nextFromQuestionPhase}
                className="px-6 py-3 bg-exam-accent text-exam-accent-ink rounded-sm font-bold hover:opacity-90 transition-opacity"
              >
                {idx + 1 >= currentQuestions.length ? 'המשך' : 'שאלה הבאה ‹'}
              </button>
            </div>
          )}
        </main>
      </div>
    );
  }

  if (phase === 'vocab' && currentWord && data) {
    return (
      <div className="min-h-dvh bg-exam-paper" dir="rtl">
        <div className="sticky top-0 z-10 bg-exam-surface border-b border-exam-border">
          <div className="max-w-lg mx-auto px-4 py-3 flex items-center justify-between">
            <span className="text-sm font-bold text-exam-ink">מילים לחזרה</span>
            <span className="text-xs text-exam-ink-soft">{idx + 1} / {data.vocabWords.length}</span>
          </div>
          <div className="h-1 bg-exam-paper-alt">
            <div className="h-full bg-exam-accent transition-all" style={{ width: `${(idx / data.vocabWords.length) * 100}%` }} />
          </div>
        </div>

        <main className="max-w-lg mx-auto px-4 py-10">
          <div className="bg-exam-surface rounded-md border border-exam-border p-8 min-h-[260px] flex flex-col justify-center text-center">
            {!flipped ? (
              <div dir="ltr">
                <div className="flex items-center justify-center gap-2 mb-3">
                  <div className="font-serif text-4xl font-bold text-exam-ink">{currentWord.word}</div>
                  <button onClick={() => speak(currentWord.word)} className="text-exam-ink-soft hover:text-exam-ink transition-colors">
                    <Volume2 className="w-5 h-5" aria-hidden />
                  </button>
                </div>
                <button
                  onClick={() => setFlipped(true)}
                  dir="rtl"
                  className="mt-4 text-sm text-exam-accent hover:opacity-80 font-medium"
                >הצג תרגום ←</button>
              </div>
            ) : (
              <div>
                <div className="font-serif text-lg text-exam-ink-soft mb-1" dir="ltr">{currentWord.word}</div>
                <div className="text-3xl font-bold text-exam-accent">{currentWord.hebrew_translation}</div>
              </div>
            )}
          </div>

          <div className="flex gap-3 mt-6">
            <button
              onClick={() => markVocab(true)}
              className="flex-1 py-3 bg-exam-sage-bg border border-exam-sage/40 text-exam-sage-strong rounded-sm font-bold hover:opacity-80 transition-opacity flex items-center justify-center gap-1.5"
            ><Check className="w-4 h-4" strokeWidth={3} aria-hidden />זכרתי</button>
            <button
              onClick={() => markVocab(false)}
              className="flex-1 py-3 bg-exam-wrong-bg border border-exam-wrong/40 text-exam-wrong rounded-sm font-bold hover:opacity-80 transition-opacity flex items-center justify-center gap-1.5"
            ><X className="w-4 h-4" strokeWidth={3} aria-hidden />לא זכרתי</button>
          </div>
        </main>
      </div>
    );
  }

  if (phase === 'done') {
    const pct = totalAnswered > 0 ? Math.round((correctCount / totalAnswered) * 100) : null;
    return (
      <div className="min-h-dvh bg-exam-paper flex items-center justify-center px-4" dir="rtl">
        <div className="text-center max-w-sm space-y-4">
          <PartyPopper className="w-14 h-14 mx-auto text-exam-sage-strong" strokeWidth={1.5} aria-hidden />
          <h1 className="text-2xl font-bold text-exam-ink">סיימת את האימון של היום!</h1>
          <div className="flex items-center justify-center gap-6 text-sm text-exam-ink-soft">
            {pct !== null && <div><div className="text-2xl font-bold text-exam-ink">{pct}%</div>תשובות נכונות</div>}
            {vocabKnownCount > 0 && <div><div className="text-2xl font-bold text-exam-ink">{vocabKnownCount}</div>מילים שזכרת</div>}
          </div>
          <div className="flex items-center justify-center gap-1.5 text-exam-ink-soft text-sm">
            <ThumbsUp className="w-4 h-4" aria-hidden />נתראה מחר באימון הבא
          </div>
          <div className="flex gap-3 pt-2">
            <Link href="/" className="flex-1 py-3 bg-exam-accent text-exam-accent-ink rounded-sm font-semibold text-center hover:opacity-90 transition-opacity">חזרה לדף הבית</Link>
            <Link href="/stats" className="flex-1 py-3 bg-exam-surface border border-exam-border text-exam-ink rounded-sm font-semibold text-center hover:bg-exam-paper-alt transition-colors">הסטטיסטיקה שלי</Link>
          </div>
        </div>
      </div>
    );
  }

  return null;
}
