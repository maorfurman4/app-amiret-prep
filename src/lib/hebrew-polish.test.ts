import { describe, expect, it } from 'vitest';
import { polishExplanationJson, polishHebrew } from './hebrew-polish';

describe('polishHebrew', () => {
  it('turns "eng = gloss — reason" into "eng (gloss): reason"', () => {
    expect(polishHebrew('invited = הזמינה — הפוך מהשפעה שלילית')).toBe('invited (הזמינה): הפוך מהשפעה שלילית');
    expect(polishHebrew('נכון! drove = דחפה — תוצאה טבעית של תמחור אגרסיבי')).toBe('נכון! drove (דחפה): תוצאה טבעית של תמחור אגרסיבי');
  });

  it('turns short leading labels into "Label: text"', () => {
    expect(polishHebrew('הפוך — נאמר נעדר, לא כלל')).toBe('הפוך: נאמר נעדר, לא כלל');
    expect(polishHebrew('❌ שגוי — הפסקה אומרת שהנהר עולה על גדותיו.')).toBe('❌ שגוי: הפסקה אומרת שהנהר עולה על גדותיו.');
    expect(polishHebrew('שאלת פרט — פסקה שלישית.')).toBe('שאלת פרט: פסקה שלישית.');
  });

  it('turns other Hebrew-adjacent dashes into sentence breaks', () => {
    expect(polishHebrew('בצורת הורסת כלכלה שברירית — מה היא תעשה לה?')).toBe('בצורת הורסת כלכלה שברירית. מה היא תעשה לה?');
    expect(polishHebrew('נכון! A because B — אותה משמעות בדיוק.')).toBe('נכון! A because B. אותה משמעות בדיוק.');
  });

  it('leaves dashes inside pure English alone', () => {
    expect(polishHebrew('המקור: "a rare — almost unique — case" ומה שהוא אומר')).toContain('a rare — almost unique — case');
  });

  it('marks a gap written as "..." between Hebrew words', () => {
    expect(polishHebrew('המורה...נקודות זכות')).toBe('המורה ___ נקודות זכות');
    expect(polishHebrew('דוח המבקר ...מספר אי-סדרים')).toBe('דוח המבקר ___ מספר אי-סדרים');
  });

  it('does not change wording, and is idempotent', () => {
    const s = 'סותר — עדיין לא נפתרה התעלומה';
    const once = polishHebrew(s);
    expect(once).toBe('סותר: עדיין לא נפתרה התעלומה');
    expect(polishHebrew(once)).toBe(once);
  });

  it('does not nest parentheses when the gloss already has some', () => {
    expect(polishHebrew('whisper = ללחוש (לא בהטיה נכונה) — לא מתאים')).toBe('whisper = ללחוש (לא בהטיה נכונה). לא מתאים');
  });

  it('keeps a one-letter prefix attached to the gap', () => {
    expect(polishHebrew('איש המכירות ניסה ל...את הלקוח')).toBe('איש המכירות ניסה ל___ את הלקוח');
  });

  it('avoids a double colon after a label', () => {
    expect(polishHebrew('✅ נכון — הפסקה אומרת: תומכים טוענים')).toBe('✅ נכון. הפסקה אומרת: תומכים טוענים');
  });

  it('puts a long Hebrew explanation first and the English phrase in parentheses', () => {
    expect(polishHebrew('fair in letter but not in spirit = מבנה ניגוד בין חוקיות פורמלית לתחושת צדק מהותית.'))
      .toBe('מבנה ניגוד בין חוקיות פורמלית לתחושת צדק מהותית (fair in letter but not in spirit).');
  });

  it('turns a short "ENG = gloss" into "ENG (gloss)", also mid-text', () => {
    expect(polishHebrew('abandon = לנטוש. מחסור במימון מוביל לנטישה.')).toBe('abandon (לנטוש). מחסור במימון מוביל לנטישה.');
    expect(polishHebrew('מה עושה חברה? shelve = לדחות ללא הכרעה.')).toBe('מה עושה חברה? shelve (לדחות ללא הכרעה).');
    expect(polishHebrew('רמז: shelve = לדחות ללא הכרעה.')).toBe('רמז: shelve (לדחות ללא הכרעה).');
  });

  it('keeps a gloss that is followed by its reason', () => {
    expect(polishHebrew('נכון! parallel = מקביל, מתאים למסקנות דומות ממקורות שונים'))
      .toBe('נכון! parallel (מקביל): מתאים למסקנות דומות ממקורות שונים');
    expect(polishHebrew('נכון! concentrate resources on = לרכז משאבים על; הביטוי הנכון'))
      .toBe('נכון! concentrate resources on (לרכז משאבים על): הביטוי הנכון');
  });

  it('leaves English-to-English equations alone', () => {
    expect(polishHebrew('נכון! A = B. אותה משמעות.')).toBe('נכון! A = B. אותה משמעות.');
  });

  it('keeps ellipses intact', () => {
    expect(polishHebrew('not simply... — אותה משמעות')).toBe('not simply... אותה משמעות');
  });

  it('leaves text without Hebrew untouched', () => {
    expect(polishHebrew('plain — english')).toBe('plain — english');
  });
});

describe('polishExplanationJson', () => {
  it('polishes every field and keeps four options in order', () => {
    const raw = JSON.stringify({
      strategy: 'שאלת הסקה — הפסקה האחרונה.',
      correct_reason: 'devastate = להרוס — בצורת ממוטטת חקלאות',
      options_analysis: ['stabilize = לייצב — בצורת לא מייצבת', 'נכון! devastate = להרוס — ממוטטת', 'הפוך — לא', 'לא קשור'],
    });
    const out = JSON.parse(polishExplanationJson(raw)!);
    expect(out.strategy).toBe('שאלת הסקה: הפסקה האחרונה.');
    expect(out.correct_reason).toBe('devastate (להרוס): בצורת ממוטטת חקלאות');
    expect(out.options_analysis).toEqual(['stabilize (לייצב): בצורת לא מייצבת', 'נכון! devastate (להרוס): ממוטטת', 'הפוך: לא', 'לא קשור']);
  });

  it('returns null for unparseable input', () => {
    expect(polishExplanationJson('not json')).toBeNull();
  });
});
