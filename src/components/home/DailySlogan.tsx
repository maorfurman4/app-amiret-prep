'use client';

import { useDashboardSummary } from '@/lib/dashboard-context';
import { todayLocalStr } from '@/lib/date-local';

export const SLOGANS = [
  'כל שאלה שאתה פותר מקרבת אותך לפטור.',
  'התמדה קטנה כל יום מנצחת מאמץ גדול פעם בשבוע.',
  'לא צריך להיות מושלם — צריך להתקדם.',
  '134 זה לא מזל, זה הרגלים.',
  'היום שתרגלת בו שווה יותר מהיום שחיכית בו.',
  'הדרך לפטור עוברת דרך היום הזה.',
  'מילה חדשה היום היא נקודה במבחן.',
  'גם חמש דקות היום שוות יותר מאפס.',
  'אתה בונה את הציון שלך שאלה אחרי שאלה.',
  'הקצב שלך חשוב יותר מהמהירות.',
  'טעות שאתה מתקן היום היא תשובה נכונה במבחן.',
  'אתה קרוב יותר מאתמול.',
  'אל תחכה להרגיש מוכן — תתאמן ותהיה מוכן.',
  'עקביות מנצחת מוטיבציה.',
  'כל חזרה מחזקת את הזיכרון בדיוק כשהוא מתחיל לדעוך.',
  'הפטור מתחיל בהרגל, לא בהברקה.',
  'תתמקד בצעד הבא, לא בכל הדרך.',
  'אתה מתאמן עכשיו כדי להיות רגוע ביום המבחן.',
  'ההבדל בין 120 ל-134 הוא כמה ימים כמו היום.',
  'אתה כאן שוב, וזה בדיוק מה שעובד.',
] as const;

/** Today's slogan for a YYYY-MM-DD day: day of year mod 20, the same all day. */
export function sloganFor(dateStr: string): string {
  const [y, m, d] = dateStr.split('-').map(Number);
  const dayOfYear = (Date.UTC(y, m - 1, d) - Date.UTC(y, 0, 1)) / 86_400_000;
  return SLOGANS[dayOfYear % SLOGANS.length];
}

/**
 * One quiet line under the greeting that changes once a day (Israel date).
 * The page is prerendered, so like the greeting it appears only once the
 * summary has settled, in a slot that holds its height meanwhile.
 */
export function DailySlogan() {
  const { loading } = useDashboardSummary();
  return (
    <p className="mt-3 min-h-[1.45em] text-[12.5px] leading-[1.45] text-exam-ink-soft">
      {!loading && <span className="animate-fade-up">{sloganFor(todayLocalStr())}</span>}
    </p>
  );
}
