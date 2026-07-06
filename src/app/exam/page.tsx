'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import type { ExamMode } from '@/types/exam';
import { BackNav } from '@/components/BackNav';
import { authFetch } from '@/lib/auth-fetch';

const MODES: { mode: ExamMode; title: string; desc: string; icon: string; isPractice?: boolean }[] = [
  {
    mode: 'full',
    title: 'מבחן מלא',
    desc: '6 פרקים + פרק ניסיוני, טיימר קשיח, אלגוריתם אדפטיבי — בדיוק כמו האמירנ"ט האמיתי',
    icon: '🎯',
  },
  {
    mode: 'practice',
    title: 'מוד תרגול',
    desc: 'ללא טיימר, ניתן לראות הסברים מיד — לתרגול נינוח ובקצב שלך',
    icon: '📚',
    isPractice: true,
  },
  {
    mode: 'section',
    title: 'תרגול סעיף',
    desc: 'בחר סוג שאלות ספציפי לתרגול ממוקד',
    icon: '🔍',
  },
];

export default function ExamModePage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [reviewCount, setReviewCount] = useState<number | null>(null);

  useEffect(() => {
    const guestId = localStorage.getItem('amiret_guest_id') ?? '';
    if (!guestId) return;
    authFetch(`/api/review-queue?guestId=${encodeURIComponent(guestId)}`)
      .then(r => r.ok ? r.json() : null)
      .then((d: { count: number } | null) => { if (d?.count) setReviewCount(d.count); })
      .catch(() => {});
  }, []);

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
    <div className="min-h-screen bg-slate-50 dark:bg-slate-900 flex flex-col" dir="rtl">
      <BackNav backHref="/" backLabel="דף הבית" />
      <div className="flex-1 flex flex-col items-center justify-center px-4 py-12">
      <div className="w-full max-w-2xl">
        <div className="text-center mb-10">
          <h1 className="text-3xl font-bold text-slate-900 dark:text-white mb-2">בחר מצב</h1>
          <p className="text-slate-500 dark:text-slate-400">בחר איך תרצה להתאמן היום</p>
        </div>

        {error && (
          <div className="mb-6 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl text-red-700 dark:text-red-400 text-sm text-center">
            {error}
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {MODES.map(m => (
            <button
              key={m.mode}
              onClick={() => startExam(m.mode, m.isPractice)}
              disabled={loading}
              className="group text-right p-6 bg-white dark:bg-slate-800 rounded-2xl border-2 border-slate-200 dark:border-slate-700 hover:border-blue-400 dark:hover:border-blue-500 hover:shadow-md transition-all disabled:opacity-60"
            >
              <div className="text-3xl mb-3">{m.icon}</div>
              <div className="text-lg font-bold text-slate-900 dark:text-white mb-1">{m.title}</div>
              <div className="text-sm text-slate-500 dark:text-slate-400 leading-relaxed">{m.desc}</div>
            </button>
          ))}
        </div>

        {/* Review queue */}
        <div className="mt-4">
          <button
            onClick={() => router.push('/review-queue')}
            className="w-full text-right p-6 bg-orange-50 dark:bg-orange-900/20 rounded-2xl border-2 border-orange-200 dark:border-orange-700 hover:border-orange-400 hover:shadow-md transition-all flex items-center gap-4"
          >
            <span className="text-3xl">🔁</span>
            <div>
              <div className="flex items-center gap-2">
                <div className="text-lg font-bold text-orange-900 dark:text-orange-200">חזרה על טעויות</div>
                {reviewCount !== null && (
                  <span className="px-2 py-0.5 bg-orange-500 text-white text-xs font-bold rounded-full">{reviewCount}</span>
                )}
              </div>
              <div className="text-sm text-orange-700 dark:text-orange-400 leading-relaxed">חזור על שאלות שטעית בהן — מערכת חזרה מרווחת</div>
            </div>
          </button>
        </div>

        {/* Quick diagnostic */}
        <div className="mt-4">
          <Link
            href="/diagnostic"
            className="block w-full text-right p-6 bg-teal-50 dark:bg-teal-900/20 rounded-2xl border-2 border-teal-200 dark:border-teal-700 hover:border-teal-400 hover:shadow-md transition-all"
          >
            <div className="flex items-center gap-4">
              <span className="text-3xl">🩺</span>
              <div>
                <div className="text-lg font-bold text-teal-900 dark:text-teal-200">אבחון רמה מהיר</div>
                <div className="text-sm text-teal-700 dark:text-teal-400 leading-relaxed">12 שאלות אדפטיביות בכ-10 דקות — גלה את הרמה שלך ומאיפה להתחיל</div>
              </div>
            </div>
          </Link>
        </div>

        {/* Vocabulary link */}
        <div className="mt-4 text-center">
          <Link
            href="/vocabulary"
            className="inline-flex items-center gap-2 px-5 py-2.5 bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 hover:border-blue-400 hover:shadow-sm transition-all text-sm text-slate-600 dark:text-slate-400 hover:text-blue-700 dark:hover:text-blue-400"
          >
            <span>📖</span>
            <span>אוצר מילים — כרטיסיות לימוד</span>
          </Link>
        </div>

        {/* Tips link */}
        <div className="mt-4 text-center">
          <Link
            href="/tips"
            className="inline-flex items-center gap-2 px-5 py-2.5 bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 hover:border-blue-400 hover:shadow-sm transition-all text-sm text-slate-600 dark:text-slate-400 hover:text-blue-700 dark:hover:text-blue-400"
          >
            <span>✨</span>
            <span>אסטרטגיות לפי סוג שאלה</span>
          </Link>
        </div>
      </div>
      </div>
    </div>
  );
}
