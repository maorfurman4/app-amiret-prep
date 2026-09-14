'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { authFetch } from '@/lib/auth-fetch';
import type { QuestionType, DifficultyLevel } from '@/types/exam';

const QUESTION_TYPES: { value: QuestionType; label: string }[] = [
  { value: 'sentence_completion', label: 'השלמת משפטים' },
  { value: 'restatement', label: 'ניסוח מחדש' },
  { value: 'reading_comprehension', label: 'הבנת הנקרא' },
  { value: 'esra', label: 'ESRA אנגלית' },
];

/**
 * UX-level gate only — /api/questions/generate enforces the real
 * ADMIN_EMAILS check server-side regardless of what this page does.
 * Without this, any visitor could load the full panel UI (they just
 * couldn't successfully submit).
 */
function useAdminGate() {
  const router = useRouter();
  const [status, setStatus] = useState<'checking' | 'allowed' | 'denied'>('checking');

  useEffect(() => {
    let cancelled = false;
    authFetch('/api/admin/check')
      .then(r => (r.ok ? r.json() as Promise<{ isAdmin: boolean }> : { isAdmin: false }))
      .then(d => { if (!cancelled) setStatus(d.isAdmin ? 'allowed' : 'denied'); })
      .catch(() => { if (!cancelled) setStatus('denied'); });
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    if (status === 'denied') router.replace('/');
  }, [status, router]);

  return status;
}

export default function AdminPage() {
  const gate = useAdminGate();

  const [type, setType] = useState<QuestionType>('sentence_completion');
  const [difficulty, setDifficulty] = useState<DifficultyLevel>(3);
  const [count, setCount] = useState(5);
  const [generatePassage, setGeneratePassage] = useState(true);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleGenerate = async () => {
    setLoading(true);
    setResult(null);
    setError(null);

    try {
      const res = await authFetch('/api/questions/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type, difficulty, count, generatePassage }),
      });

      const data = await res.json() as { inserted?: number; passageId?: string; error?: string };

      if (!res.ok || data.error) {
        setError(data.error ?? 'שגיאה');
        return;
      }

      setResult(
        data.passageId
          ? `✅ נוצר קטע (${data.passageId}) עם ${data.inserted} שאלות`
          : `✅ נוצרו ${data.inserted} שאלות`
      );
    } catch {
      setError('שגיאת רשת');
    } finally {
      setLoading(false);
    }
  };

  // Blank while checking (avoid a flash of the panel) and while redirecting a denied visitor.
  if (gate !== 'allowed') return null;

  return (
    <div className="min-h-screen bg-slate-50 py-10 px-4" dir="rtl">
      <div className="max-w-xl mx-auto space-y-6">
        <h1 className="text-2xl font-black text-slate-900">⚙️ פאנל אדמין</h1>
        <p className="text-slate-500 text-sm">
          שימוש ב-GPT-4o ליצירת שאלות ושמירה ישירה ל-Supabase.
          <strong> לא ישמש במהלך מבחן פעיל.</strong>
        </p>

        <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-200 space-y-5">
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-2">סוג שאלה</label>
            <select
              value={type}
              onChange={e => setType(e.target.value as QuestionType)}
              className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-400 outline-none"
            >
              {QUESTION_TYPES.map(t => (
                <option key={t.value} value={t.value}>{t.label}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-2">
              רמת קושי: {difficulty}/5
            </label>
            <input
              type="range" min={1} max={5} value={difficulty}
              onChange={e => setDifficulty(parseInt(e.target.value) as DifficultyLevel)}
              className="w-full accent-blue-600"
            />
            <div className="flex justify-between text-xs text-slate-400 mt-1">
              <span>קל מאוד</span><span>קשה מאוד</span>
            </div>
          </div>

          {type !== 'reading_comprehension' && (
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-2">כמות שאלות</label>
              <input
                type="number" min={1} max={20} value={count}
                onChange={e => setCount(parseInt(e.target.value))}
                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-400 outline-none"
              />
            </div>
          )}

          {type === 'reading_comprehension' && (
            <div className="flex items-center gap-2">
              <input
                type="checkbox" id="newPassage" checked={generatePassage}
                onChange={e => setGeneratePassage(e.target.checked)}
                className="accent-blue-600"
              />
              <label htmlFor="newPassage" className="text-sm text-slate-700">
                צור קטע חדש (5 שאלות)
              </label>
            </div>
          )}

          <button
            onClick={handleGenerate}
            disabled={loading}
            className="w-full py-3 bg-blue-600 text-white rounded-xl font-bold hover:bg-blue-700 disabled:opacity-60 transition-colors"
          >
            {loading ? '⏳ מייצר שאלות עם GPT-4o...' : '✨ צור שאלות'}
          </button>

          {result && (
            <div className="p-3 bg-green-50 border border-green-200 rounded-lg text-green-800 text-sm">{result}</div>
          )}
          {error && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">{error}</div>
          )}
        </div>

        {/* Quick bulk generation */}
        <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-200">
          <h2 className="font-bold text-slate-900 mb-3">יצירת מאגר מהיר (מומלץ לתחילת הדרך)</h2>
          <p className="text-sm text-slate-500 mb-4">
            צור 5 שאלות לכל שילוב של סוג × רמה = 75 שאלות + 5 קטעי קריאה
          </p>
          <BulkGenerateButton />
        </div>
      </div>
    </div>
  );
}

function BulkGenerateButton() {
  const [progress, setProgress] = useState('');
  const [running, setRunning] = useState(false);

  const runBulk = async () => {
    setRunning(true);
    const types: QuestionType[] = ['sentence_completion', 'restatement', 'esra'];
    const difficulties: DifficultyLevel[] = [1, 2, 3, 4, 5];

    for (const t of types) {
      for (const d of difficulties) {
        setProgress(`מייצר ${t} רמה ${d}...`);
        await authFetch('/api/questions/generate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ type: t, difficulty: d, count: 5 }),
        });
      }
    }

    for (const d of difficulties) {
      setProgress(`מייצר קטע הבנת הנקרא רמה ${d}...`);
      await authFetch('/api/questions/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: 'reading_comprehension', difficulty: d, generatePassage: true }),
      });
    }

    setProgress('✅ הושלם!');
    setRunning(false);
  };

  return (
    <div>
      <button
        onClick={runBulk}
        disabled={running}
        className="w-full py-3 bg-emerald-600 text-white rounded-xl font-bold hover:bg-emerald-700 disabled:opacity-60 transition-colors"
      >
        {running ? '⏳ מייצר...' : '🚀 צור מאגר מלא'}
      </button>
      {progress && <div className="mt-3 text-sm text-slate-600">{progress}</div>}
    </div>
  );
}
