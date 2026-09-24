'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Target, BookOpen, Search, Stethoscope, Sparkles, type LucideIcon } from 'lucide-react';
import type { ExamMode } from '@/types/exam';
import { BackNav } from '@/components/BackNav';
import { authFetch } from '@/lib/auth-fetch';

const MODES: { mode: ExamMode; title: string; desc: string; icon: LucideIcon; isPractice?: boolean }[] = [
  {
    mode: 'full',
    title: 'סימולציית פרקי הליבה',
    desc: '6 פרקי הליבה בזמנים הרשמיים ובמבנה אדפטיבי, ולאחריהם תרגול חלופי. אינו מדמה עדיין את סוגי הפרקים הניסיוניים או הכתיבה',
    icon: Target,
  },
  {
    mode: 'practice',
    title: 'מוד תרגול',
    desc: 'ללא טיימר, ניתן לראות הסברים מיד — לתרגול נינוח ובקצב שלך',
    icon: BookOpen,
    isPractice: true,
  },
  {
    mode: 'section',
    title: 'תרגול סעיף',
    desc: 'בחר סוג שאלות ספציפי לתרגול ממוקד',
    icon: Search,
  },
];

export default function ExamModePage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const getOrCreateGuestId = () => {
    let id = localStorage.getItem('amiret_guest_id');
    if (!id) { id = crypto.randomUUID(); localStorage.setItem('amiret_guest_id', id); }
    return id;
  };

  // Ensure guestId exists on first visit
  useEffect(() => {
    if (!localStorage.getItem('amiret_guest_id')) {
      localStorage.setItem('amiret_guest_id', crypto.randomUUID());
    }
  }, []);

  const startExam = async (mode: ExamMode, isPractice = false) => {
    setLoading(true);
    setError(null);

    if (mode === 'section') {
      setLoading(false);
      router.push('/practice');
      return;
    }

    try {
      const guestId = getOrCreateGuestId();
      const res = await authFetch('/api/exam/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mode, isPractice, guestId }),
      });

      if (!res.ok) {
        setError('שגיאה ביצירת מבחן. נסה שוב.');
        return;
      }

      const { sessionId } = await res.json() as { sessionId: string };
      router.push(`/exam/${sessionId}`);
    } catch {
      setError('שגיאת רשת. בדוק חיבור אינטרנט.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-dvh bg-exam-paper flex flex-col" dir="rtl">
      <BackNav backHref="/" backLabel="דף הבית" />
      <div className="flex-1 flex flex-col items-center justify-center px-4 py-12">
      <div className="w-full max-w-2xl">
        <div className="text-center mb-10">
          <h1 className="text-3xl font-bold text-exam-ink mb-2">בחר מצב</h1>
          <p className="text-exam-ink-soft">בחר איך תרצה להתאמן היום</p>
        </div>

        {error && (
          <div className="mb-6 p-4 bg-exam-wrong-bg border border-exam-wrong/40 rounded-sm text-exam-wrong text-sm text-center">
            {error}
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {MODES.map(m => (
            <button
              key={m.mode}
              onClick={() => startExam(m.mode, m.isPractice)}
              disabled={loading}
              className="text-right p-6 bg-exam-surface rounded-md border border-exam-border hover:bg-exam-paper-alt hover:border-exam-border-strong transition-colors disabled:opacity-60"
            >
              <m.icon className="w-8 h-8 mb-3 text-exam-ink-soft" strokeWidth={1.5} aria-hidden />
              <div className="text-lg font-bold text-exam-ink mb-1">{m.title}</div>
              <div className="text-sm text-exam-ink-soft leading-relaxed">{m.desc}</div>
            </button>
          ))}
        </div>

        {/* Quick diagnostic */}
        <div className="mt-4">
          <Link
            href="/diagnostic"
            className="block w-full text-right p-6 bg-exam-surface rounded-md border border-exam-border hover:bg-exam-paper-alt hover:border-exam-border-strong transition-colors"
          >
            <div className="flex items-center gap-4">
              <Stethoscope className="w-8 h-8 text-exam-ink-soft flex-shrink-0" strokeWidth={1.5} aria-hidden />
              <div>
                <div className="text-lg font-bold text-exam-ink">אבחון רמה מהיר</div>
                <div className="text-sm text-exam-ink-soft leading-relaxed">6–10 שאלות אדפטיביות בכ-5 דקות — גלה את הרמה שלך ומאיפה להתחיל</div>
              </div>
            </div>
          </Link>
        </div>

        {/* Tips link */}
        <div className="mt-4 text-center">
          <Link
            href="/tips"
            className="hit-44 inline-flex items-center gap-2 px-5 py-2.5 bg-exam-surface rounded-sm border border-exam-border hover:bg-exam-paper-alt hover:border-exam-border-strong transition-colors text-sm text-exam-ink-soft hover:text-exam-ink"
          >
            <Sparkles className="w-4 h-4" strokeWidth={1.75} aria-hidden />
            <span>אסטרטגיות לפי סוג שאלה</span>
          </Link>
        </div>
      </div>
      </div>
    </div>
  );
}
