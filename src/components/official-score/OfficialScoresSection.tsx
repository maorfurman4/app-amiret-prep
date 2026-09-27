'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { Award, Pencil, Plus, Trash2 } from 'lucide-react';
import { authFetch } from '@/lib/auth-fetch';
import { formatExamDate } from '@/components/home/ExamDateCard';
import { Modal } from '@/components/ui/Modal';
import type { TestType } from '@/lib/official-score';
import { OfficialScoreForm, SavedScoreResult, TEST_TYPES, type SavedScore } from './OfficialScoreForm';

type Row = { id: number; test_type: TestType; score: number; test_date: string; app_score: number | null };

/** Anchor for the user-menu link (entry point D). */
export const OFFICIAL_SCORES_ANCHOR = 'official-scores';

/**
 * Entry point C: "הציונים הרשמיים שלי" on the stats page — the student's
 * reported NITE scores, with add / edit / delete. Always available, never a
 * pop-up. Accounts only (renders nothing for guests).
 */
export function OfficialScoresSection() {
  const [rows, setRows] = useState<Row[] | null>(null);
  const [editing, setEditing] = useState<Row | 'new' | null>(null);
  const [saved, setSaved] = useState<SavedScore | null>(null);
  const [error, setError] = useState<string | null>(null);
  const ref = useRef<HTMLElement>(null);

  const load = useCallback(() => {
    authFetch('/api/official-score')
      .then(r => (r.ok ? r.json() : null))
      .then((d: { scores: Row[] } | null) => setRows(d ? d.scores : null))
      .catch(() => {});
  }, []);

  useEffect(() => { load(); }, [load]);

  // Arriving from the user menu (/stats#official-scores): the section loads
  // after the page, so scroll once it exists.
  useEffect(() => {
    if (rows && window.location.hash === `#${OFFICIAL_SCORES_ANCHOR}`) ref.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, [rows]);

  if (!rows) return null;

  const remove = async (row: Row) => {
    if (!window.confirm(`למחוק את הציון ${row.score} מ-${formatExamDate(row.test_date)}?`)) return;
    setError(null);
    const res = await authFetch(`/api/official-score?id=${row.id}`, { method: 'DELETE' }).catch(() => null);
    if (!res?.ok) { setError('המחיקה נכשלה. נסה שוב'); return; }
    load();
  };

  const close = () => { setEditing(null); setSaved(null); };
  const typeLabel = (t: TestType) => TEST_TYPES.find(x => x.value === t)?.label ?? t;

  return (
    <section ref={ref} id={OFFICIAL_SCORES_ANCHOR} className="scroll-mt-20 bg-exam-surface rounded-2xl shadow-surface border border-exam-border p-5 animate-fade-up">
      <div className="flex items-center justify-between gap-3 mb-1">
        <h2 className="font-bold text-exam-ink flex items-center gap-2"><Award className="w-4 h-4" aria-hidden />הציונים הרשמיים שלי</h2>
        <button
          type="button"
          onClick={() => setEditing('new')}
          className="hit-44 inline-flex items-center gap-1 px-3 py-1.5 rounded-xl text-sm font-semibold text-exam-accent hover:bg-exam-accent/10 transition-colors"
        ><Plus className="w-4 h-4" aria-hidden />הוספת ציון</button>
      </div>
      <p className="text-xs text-exam-ink-soft mb-3">
        נבחנת באמירנט, באמיר״ם או בפסיכומטרי? הציון שקיבלת מכייל את האומדנים כאן מול המציאות. הוא נשמר רק בחשבון שלך.
      </p>
      {error && <p role="alert" className="text-xs font-semibold text-exam-wrong mb-2">{error}</p>}

      {rows.length === 0 ? (
        <p className="text-sm text-exam-ink-soft">עוד לא הוספת ציון.</p>
      ) : (
        <ul className="space-y-2">
          {rows.map(r => (
            <li key={r.id} className="flex items-center gap-3 p-3 rounded-xl bg-exam-paper-alt border border-exam-border">
              <div className="text-2xl font-black text-exam-ink tabular-nums w-12 text-center">{r.score}</div>
              <div className="flex-1 min-w-0 text-sm">
                <div className="font-semibold text-exam-ink">{typeLabel(r.test_type)} · {formatExamDate(r.test_date)}</div>
                <div className="text-xs text-exam-ink-soft">
                  {r.app_score !== null ? <>האומדן של האתר לפני המבחן: <span className="tabular-nums">{r.app_score}</span></> : 'אין אומדן מלפני המבחן'}
                </div>
              </div>
              <button type="button" onClick={() => setEditing(r)} aria-label={`עריכת הציון מ-${formatExamDate(r.test_date)}`} className="hit-44 p-2 rounded-lg text-exam-ink-soft hover:text-exam-ink hover:bg-exam-surface transition-colors"><Pencil className="w-4 h-4" aria-hidden /></button>
              <button type="button" onClick={() => void remove(r)} aria-label={`מחיקת הציון מ-${formatExamDate(r.test_date)}`} className="hit-44 p-2 rounded-lg text-exam-ink-soft hover:text-exam-wrong hover:bg-exam-wrong-bg transition-colors"><Trash2 className="w-4 h-4" aria-hidden /></button>
            </li>
          ))}
        </ul>
      )}

      <Modal
        open={editing !== null}
        onClose={close}
        icon={<Award className="w-5 h-5 text-exam-accent flex-shrink-0" aria-hidden />}
        title={saved ? 'הציון נשמר' : editing && editing !== 'new' ? 'עריכת ציון' : 'הוספת ציון רשמי'}
      >
        <div className="px-5 py-5">
          {saved ? (
            <SavedScoreResult saved={saved} onClose={close} />
          ) : editing && (
            <OfficialScoreForm
              key={editing === 'new' ? 'new' : editing.id}
              source="stats"
              initial={editing === 'new' ? undefined : { testDate: editing.test_date, score: editing.score, testType: editing.test_type }}
              onSaved={s => { setSaved(s); load(); }}
            />
          )}
        </div>
      </Modal>
    </section>
  );
}
