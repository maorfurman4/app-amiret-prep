'use client';

import { useEffect, useId, useState } from 'react';
import { Target } from 'lucide-react';
import { useDashboardSummary } from '@/lib/dashboard-context';
import { authFetch } from '@/lib/auth-fetch';
import { createClient } from '@/lib/supabase';
import { goalPromptKey } from '@/lib/daily-goal';
import { GoalStepper } from '@/components/GoalStepper';
import { CARD, ICON_TILE } from './surfaces';

const TACTILE = 'transition-[background-color,border-color,box-shadow,transform] duration-300 ease-spring will-change-transform';

/**
 * Asks an account once for its daily goal (the practice ring's question
 * count), then never again on this device: saving or "לא עכשיו" both count
 * as asked. It can be changed any time in the account menu. Guests can't
 * store a goal (user_goals → auth.users), so they aren't asked.
 */
export function DailyGoalPrompt() {
  const { data, patch } = useDashboardSummary();
  const titleId = useId();
  // The account to remember "asked" for; null until known, or when already asked.
  const [askFor, setAskFor] = useState<string | null>(null);
  const [value, setValue] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isAccount = !!data?.canSetExamDate;
  useEffect(() => {
    if (!isAccount) return;
    let live = true;
    createClient().auth.getSession().then(({ data: { session } }) => {
      const id = session?.user.id;
      if (!live || !id) return;
      try { if (localStorage.getItem(goalPromptKey(id))) return; } catch { /* Ask this session only. */ }
      setAskFor(id);
    });
    return () => { live = false; };
  }, [isAccount]);

  if (!data || !askFor) return null;
  // The exam-date and official-score prompts own the slot above; one ask at a time.
  if (data.officialScorePrompt) return null;

  const target = value ?? data.rings.effort.target;
  const markAsked = () => {
    try { localStorage.setItem(goalPromptKey(askFor), '1'); } catch { /* Storage is optional. */ }
    setAskFor(null);
  };

  const save = async () => {
    setSaving(true);
    setError(null);
    try {
      const res = await authFetch('/api/goals', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ dailyActivityTarget: target }),
      });
      if (!res.ok) { setError('השמירה נכשלה. נסה שוב'); return; }
      patch({ rings: { ...data.rings, effort: { ...data.rings.effort, target } } });
      markAsked();
    } catch {
      setError('אין חיבור. נסה שוב');
    } finally {
      setSaving(false);
    }
  };

  return (
    <section aria-labelledby={titleId} className={`w-full p-4 space-y-3 animate-fade-up ${CARD}`} data-goal-prompt>
      <div className="flex items-start gap-3">
        <span className={`${ICON_TILE} size-10`}><Target className="w-5 h-5" strokeWidth={1.75} aria-hidden /></span>
        <div className="flex-1 min-w-0">
          <h3 id={titleId} className="font-bold text-[15px] tracking-[-0.01em]">מה היעד היומי שלך?</h3>
          <p className="mt-0.5 text-[12.5px] leading-snug text-exam-ink-soft">כמה שאלות תרגול ביום? אפשר לשנות בכל רגע בתפריט החשבון.</p>
        </div>
      </div>
      <div className="flex items-center justify-center gap-2 text-exam-ink">
        <GoalStepper value={target} onChange={setValue} labelledBy={titleId} buttonClass="border border-exam-border bg-exam-surface hover:bg-exam-paper-alt" />
        <span className="text-sm text-exam-ink-soft">שאלות ביום</span>
      </div>
      {error && <p role="alert" className="text-xs font-semibold text-exam-wrong">{error}</p>}
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => void save()}
          disabled={saving}
          className={`flex-1 h-11 bg-exam-accent text-exam-accent-ink font-bold rounded-xl shadow-raised hover:shadow-overlay active:shadow-pressed hover:-translate-y-0.5 active:translate-y-0 active:scale-[0.97] disabled:opacity-50 disabled:pointer-events-none ${TACTILE}`}
        >
          {saving ? 'שומר…' : 'שמירת היעד'}
        </button>
        <button
          type="button"
          onClick={markAsked}
          disabled={saving}
          className={`h-11 px-4 rounded-xl border border-exam-border text-exam-ink-soft hover:bg-exam-paper-alt active:scale-[0.97] ${TACTILE}`}
        >
          לא עכשיו
        </button>
      </div>
    </section>
  );
}
