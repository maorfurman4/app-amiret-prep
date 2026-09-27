'use client';

import { useEffect, useState } from 'react';
import { Award } from 'lucide-react';
import { authFetch } from '@/lib/auth-fetch';
import { shouldShowResultsPrompt } from '@/lib/official-score';
import { Modal } from '@/components/ui/Modal';
import { OfficialScoreForm, SavedScoreResult, type SavedScore } from './OfficialScoreForm';

/**
 * Entry point B: one quiet line under the exam results — for students who
 * already sat the real test (often retakers), whom the exam-date prompt
 * never reaches. Accounts only; hidden once they have reported a score,
 * after "לא, תודה" (60 days), and on all but the 1st, 6th, 11th… exam.
 */
export function ResultsScorePrompt() {
  const [visible, setVisible] = useState(false);
  const [open, setOpen] = useState(false);
  const [saved, setSaved] = useState<SavedScore | null>(null);

  useEffect(() => {
    let cancelled = false;
    authFetch('/api/official-score')
      .then(r => (r.ok ? r.json() : null))
      .then((d: { scores: unknown[]; dismissedAt: string | null; completedExams: number } | null) => {
        if (cancelled || !d) return;
        setVisible(shouldShowResultsPrompt({
          completedExams: d.completedExams, hasReports: d.scores.length > 0, dismissedAt: d.dismissedAt, now: new Date(),
        }));
      })
      .catch(() => {});
    return () => { cancelled = true; };
  }, []);

  if (!visible) return null;

  const decline = () => {
    authFetch('/api/official-score/dismiss', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ scope: 'general' }),
    }).catch(() => {});
    setVisible(false);
  };

  return (
    <>
      <div className="flex flex-wrap items-center justify-center gap-x-3 gap-y-1 text-sm text-exam-ink-soft animate-fade-up">
        <Award className="w-4 h-4 text-exam-accent" aria-hidden />
        <span>כבר נבחנת באמירנט האמיתי?</span>
        <button type="button" onClick={() => setOpen(true)} className="hit-44 font-semibold text-exam-accent hover:underline">
          הוסף את הציון
        </button>
        <button type="button" onClick={decline} className="hit-44 text-xs hover:text-exam-ink">לא, תודה</button>
      </div>
      <Modal
        open={open}
        onClose={() => { setOpen(false); if (saved) setVisible(false); }}
        icon={<Award className="w-5 h-5 text-exam-accent flex-shrink-0" aria-hidden />}
        title={saved ? 'הציון נשמר' : 'הציון הרשמי שלך'}
      >
        <div className="px-5 py-5">
          {saved
            ? <SavedScoreResult saved={saved} onClose={() => { setOpen(false); setVisible(false); }} />
            : <OfficialScoreForm source="results" onSaved={setSaved} />}
        </div>
      </Modal>
    </>
  );
}
