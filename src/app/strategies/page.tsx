'use client';

import { useState } from 'react';
import Link from 'next/link';
import { BackNav } from '@/components/BackNav';

/* ─── חוקי המשחק ──────────────────────────────────────────────────────────── */

const RULES_INTRO =
  'הרוב המכריע של הנקודות שנבחנים מפסידים באמירנ"ט לא נופל בגלל חוסר ידע באנגלית — הוא נופל בגלל שהם לא ידעו איך המנגנון עצמו עובד, והתנהגו לפי אינסטינקטים ממבחנים "רגילים" שלא מתאימים כאן. ' +
  'המבחן הזה בנוי על שלושה מנגנונים ייחודיים (אדפטיביות, נעילת פרקים, וטיימר קשיח) שכל אחד מהם דורש התנהגות שונה מהמצופה. הכר אותם קודם — הם ישפיעו על כל החלטה טקטית שתקבל בהמשך.';

const GAME_RULES = [
  {
    icon: '🔀',
    title: 'המבחן אדפטיבי — קושי עולה = סימן טוב',
    body:
      'המבחן לא שואל את כל הנבחנים את אותן שאלות. אחרי כל פרק, אלגוריתם סטטיסטי (IRT — אותו מודל שמניע גם את האבחון והתרגול המעורב באתר הזה) מעריך מחדש את הרמה שלך על סמך מה שענית, ובוחר את רמת הקושי של הפרק הבא בהתאם. ' +
      'המשמעות: אם הפרק הבא מרגיש לך קשה יותר, זה לא סימן שאתה "נכשל" — זה בדיוק ההפך: האלגוריתם זיהה שאתה מתפקד ברמה גבוהה, ומעלה את הרף כדי למדוד אותך בדיוק. ' +
      'נבחן שנבהל מקושי עולה ומתחיל לפעול פחות בביטחון, פוגע בעצמו פעמיים — גם בציון וגם באיכות הריכוז. הציונים הגבוהים ביותר (120+) מגיעים אך ורק דרך פרקים קשים; אם המבחן שלך נשאר קל מתחילתו ועד סופו, זה הרף העליון שאתה יכול להגיע אליו באותה הרצה.',
  },
  {
    icon: '🚪',
    title: 'אין חזרה אחורה בין פרקים',
    body:
      'ברגע שפרק נסגר — בלחיצה מכוונת או כשהטיימר מגיע לאפס — אי אפשר לחזור אליו, בשום שלב, גם לא בסוף המבחן. זה שונה ממבחנים "רגילים" שבהם מותר לדפדף אחורה חופשי עד הסוף. ' +
      'בתוך פרק בודד, לעומת זאת, יש חופש מלא לנוע בין השאלות — כך שהאסטרטגיה הנכונה היא לנצל את החופש הזה בתוך הפרק (לדלג על שאלה קשה ולחזור אליה) ולא לסמוך עליו בין פרקים. ' +
      'המסקנה המעשית: לפני שאתה עוזב פרק — בין אם בלחיצה או כי הזמן עומד להיגמר — עשה סבב אחרון מהיר לוודא שלכל שאלה יש תשובה כלשהי מסומנת, גם אם היא ניחוש.',
  },
  {
    icon: '⏱️',
    title: 'טיימר קשיח לכל פרק — וזמן לא עובר הלאה',
    body:
      'לכל פרק הקצאת זמן נפרדת ומוחלטת (4 / 6 / 15 דקות בהתאם לסוג), והיא לא מצטברת: אם סיימת פרק מוקדם, שארית הזמן נעלמת — היא לא עוברת לפרק הבא. ' +
      'זו הסיבה שאסור "לחסוך" זמן במודע כדי "להעביר" אותו קדימה — זו אשליה. הדרך הנכונה לנצל זמן שנותר היא לחזור באותו רגע לשאלות שסימנת כלא-בטוחות בפרק הנוכחי, ולבדוק אותן שוב, כי ברגע שנסגר הפרק — הן הלכו.',
  },
  {
    icon: '🎲',
    title: 'אין קנס על טעות — מנחשים תמיד',
    body:
      'בניגוד למבחנים שיש בהם ניקוד שלילי על טעות (שם ניחוש עיוור מסוכן), באמירנ"ט שאלה ריקה ושאלה שגויה שוות בדיוק אותו דבר: אפס נקודות. אבל שאלה עם ניחוש עיוור מקנה 25% סיכוי סטטיסטי לצדק — ואם הצלחת לפסול מסיח אחד לפני שניחשת, הסיכוי קופץ ל-33%, ושניים פסולים מביאים אותך ל-50%. ' +
      'המסקנה החד-משמעית: אין שום תרחיש שבו כדאי להשאיר שאלה ריקה. גם ניחוש עיוור לגמרי, בלי לפסול כלום, עדיף אינסופית על פני להשאיר אותה ריקה.',
  },
];

/* ─── תקציב זמן ───────────────────────────────────────────────────────────── */

const TIME_INTRO =
  'בגלל שהטיימר קשיח והזמן לא עובר בין פרקים (כמו שראית בנושא "חוקי המשחק"), תזמון הוא לא עניין של משמעת אישית — הוא חלק מהחוק הפיזי של המבחן. ' +
  'ההבדל בין נבחן טוב לבינוני הוא לא כמות הידע באנגלית, אלא זה: הטוב מחליט מראש, לפני שהוא בכלל רואה שאלה, כמה זמן מותר לו "להיתקע" על כל שאלה בכל סוג — ועומד בהחלטה הזו גם כשההתקעות מרגישה אישית ומתסכלת. ' +
  'המספרים למטה בנויים כך שאם תעמוד בהם, יישאר לך תמיד זמן לסבב בדיקה אחרון לפני סגירת הפרק.';

const TIME_BUDGET = [
  {
    section: 'השלמת משפטים',
    total: '4 דק׳ / 4 שאלות',
    perQ: '~60 שניות',
    stuckCap: 'עד 90 שניות',
    note:
      'זהו הפרק הכי "יקר לדקה" — כל שאלה שקולה ל-25% מהפרק כולו. בגלל זה תקציב התקיעה קצר יחסית: שאלה שלא נפתרה תוך דקה וחצי כנראה לא תיפתר גם בעוד דקה נוספת, ' +
      'ואילו אותה דקה שהושקעה בה יכולה להציל את שלוש השאלות האחרות. ברגע שעוברים את דקה וחצי — פוסלים מה שאפשר בזריזות, מנחשים, ומתקדמים בלי חרטה.',
  },
  {
    section: 'ניסוח מחדש',
    total: '6 דק׳ / 3 שאלות',
    perQ: '~2 דקות',
    stuckCap: 'עד 2.5 דקות',
    note:
      'כאן יש הכי הרבה "אוויר" לשאלה בודדת ביחס למספר השאלות בפרק — ולא במקרה: משפטי המקור בניסוח מחדש דורשים פירוק מדוקדק ("ארבעת השומרים" שמופיעים בנושא ניסוח מחדש), וזה תהליך שדורש זמן קריאה חוזרת. ' +
      'נצל את הפער הזה: זה הפרק שבו כדאי להשוות שיטתית כל מסיח מול משפט המקור, ולא רק לבחור לפי "הרגשה".',
  },
  {
    section: 'הבנת הנקרא',
    total: '15 דק׳ / 5 שאלות',
    perQ: '4–5 דק׳ קריאה + ~2 דק׳ לשאלה',
    stuckCap: 'עד 3 דקות לשאלה',
    note:
      'זה הפרק הכי גמיש מבחינת תזמון, כי הקריאה הראשונית של הקטע (4-5 דקות) היא השקעה חד-פעמית שמשרתת את כל 5 השאלות יחד — לא תשלום נפרד לכל שאלה. ' +
      'בזכות זה, שאלה תקועה כאן שווה יותר לדחות ולחזור אליה בסוף הפרק (אחרי שכל השאר קיבלו תשובה) מאשר להיתקע עליה מוקדם ולסכן את הזמן לשאלות הקלות יותר שנשארו.',
  },
];

/* ─── שיטות עבודה לכל סוג שאלה ─────────────────────────────────────────────── */

interface QuestionGuide {
  id: string;
  icon: string;
  color: 'blue' | 'purple' | 'green';
  titleHe: string;
  titleEn: string;
  intro: string;
  approach: { step: string; detail: string }[];
  stuck: { step: string; detail: string }[];
  tipsHref: string;
  workedExample: {
    prompt: string;
    options: string[];
    correctIndex: number;
    walkthrough: string[];
  };
}

const QUESTION_GUIDES: QuestionGuide[] = [
  {
    id: 'sentence-completion',
    icon: '✏️',
    color: 'blue',
    titleHe: 'השלמת משפטים',
    titleEn: 'Sentence Completion',
    intro:
      'זה לא מבחן אוצר מילים — זה מבחן על היכולת לצפות מה חסר לפני שרואים את האפשרויות. משפט טוב תמיד "מרמז" מה צריך להיכנס בפער, דרך מילת הקישור שבו (ראה נושא "מילות קישור") והטון הכללי שלו. ' +
      'מי שקורא את המשפט וקובע בראש כיוון ברור — חיובי/שלילי, ניגוד/המשך — לפני שהוא בכלל מסתכל על התשובות, לא ניתן לפתות על ידי מסיח שנשמע "יפה" באנגלית אבל לא מתאים להקשר. השיטה למטה בנויה בדיוק סביב העיקרון הזה.',
    approach: [
      { step: 'קרא את המשפט כולו', detail: 'לא רק את הסביבה של הפער. הבן מה המשפט מנסה להגיד.' },
      { step: 'אתר את מילת הקישור', detail: 'although / but / despite = ניגוד; because / therefore = סיבה-תוצאה; also / moreover = תוספת. היא קובעת את כיוון התשובה.' },
      { step: 'השלם בראש — לפני שקוראים תשובות', detail: 'נחש מילה משלך (או לפחות: "צריך כאן משהו חיובי / פועל / תואר"). כך המסיחים לא ישתלו לך רעיון.' },
      { step: 'עבור על 4 התשובות ופסול', detail: 'פסול מה שלא מסתדר במשמעות, בטון (חיובי/שלילי) או בדקדוק (סוג מילה שגוי).' },
      { step: 'הצב את הבחירה במשפט וקרא אותו שוב', detail: 'אם המשפט זורם והגיוני מההתחלה עד הסוף — סמן והתקדם.' },
    ],
    stuck: [
      { step: 'לא מכיר את המילים בתשובות?', detail: 'פרק אותן: תחילית (un-/dis- = שלילה, re- = שוב) + סופית (-tion = שם עצם, -ful/-ive = תואר). לרוב זה מספיק כדי לפסול שניים.' },
      { step: 'לא מבין את המשפט עצמו?', detail: 'זהה רק את הטון: האם הסוף "טוב" או "רע"? מילת הקישור + טון = בחירה מושכלת גם בלי להבין הכל.' },
      { step: 'נשארו שתי תשובות שקולות?', detail: 'בחר את זו שמתאימה יותר דקדוקית (מסתדרת עם מילת היחס שאחרי הפער). עדיין תיקו? בחר ועבור הלאה — 50% זה מצוין.' },
      { step: 'עברו 90 שניות?', detail: 'עצור. נחש מבין מה שנשאר, סמן, והתקדם. שאלה אחת לא שווה את שלוש האחרות.' },
    ],
    tipsHref: '/tips/sentence-completion',
    workedExample: {
      prompt: 'Although the manager praised the report, she asked the team to ___ several sections before the final submission.',
      options: ['ignore', 'revise', 'publish', 'discard'],
      correctIndex: 1,
      walkthrough: [
        'מילת קישור: "Although" = ניגוד. יש שבח ("praised") — אז מה שבא אחרי חייב להיות הפוך/מנוגד לשבח מוחלט, לא המשך חיובי סתמי.',
        'השלמה עצמאית בראש: "היא ביקשה מהצוות לעשות משהו לדוחות לפני ההגשה" — סביר שמדובר בתיקון/שיפור, לא בפעולה קיצונית.',
        'פסילה: "ignore" (להתעלם) סותר לוגית — למה לבקש להתעלם מסעיפים לפני הגשה סופית? "publish" (לפרסם) לא מתאים — זו כבר "הגשה סופית", לא פרסום. "discard" (לזרוק) קיצוני מדי מול "praised" (היא ציינה שבח, לא פסילה מוחלטת).',
        '"revise" (לתקן/לערוך) — היחיד שמתיישב עם הניגוד העדין של "although": שבח כללי, אבל עדיין יש מה לשפר לפני הסוף. זו התשובה.',
      ],
    },
  },
  {
    id: 'restatement',
    icon: '🔄',
    color: 'purple',
    titleHe: 'ניסוח מחדש',
    titleEn: 'Restatement',
    intro:
      'זה בעצם מבחן על "מה נשמר ומה השתנה" — מבין ארבע ניסוחים, שלושה משנים בשקט פרט קטן אחד (כמות, זמן, כיוון, או מי-עשה-מה), ורק אחד באמת אומר את אותו הדבר במילים אחרות. ' +
      'הטעות הנפוצה ביותר היא לחפש את התשובה ה"יפה" ביותר באנגלית — אבל המבחן בודק דיוק לוגי, לא סגנון. לכן השיטה מתחילה בחילוץ "גרעין" ברור מהמקור, לפני שבכלל מסתכלים על האפשרויות, ומשם משווים כל תשובה נגד הגרעין הזה נקודה-נקודה.',
    approach: [
      { step: 'קרא את משפט המקור פעמיים', detail: 'יש לך זמן (2 דקות לשאלה). קריאה שנייה חוסכת טעויות הבנה שעולות ביוקר.' },
      { step: 'חלץ את הגרעין — בעברית', detail: 'סכם לעצמך: מי עשה? מה קרה? ומה הקשר הלוגי (ניגוד / סיבה / תנאי / זמן)? זה "תעודת הזהות" של המשפט.' },
      { step: 'עבור מסיח-מסיח מול הגרעין', detail: 'לכל תשובה שאל: אותו מי? אותו מה? אותו כיוון? כל סטייה — פסילה מיידית.' },
      { step: 'בדוק את "ארבעת השומרים"', detail: 'כמתים (all/some/most), שלילה (not, never), זמן הפועל, וכיוון סיבה-תוצאה. אחד מהם השתנה = תשובה שגויה.' },
      { step: 'חשוד בתשובה שדומה מדי למקור', detail: 'תשובה שמעתיקה 80% מהמילים היא מלכודת קלאסית — לרוב היא מחליפה בשקט את הכיוון או הכמת. הנכונה בדרך כלל נשמעת אחרת לגמרי.' },
    ],
    stuck: [
      { step: 'לא מבין את משפט המקור?', detail: 'אל תנסה לתרגם מילה-מילה. זהה רק את השלד: מילת קישור + מי + פועל. גם הבנה חלקית מספיקה לפסול שני מסיחים.' },
      { step: 'שתי תשובות נראות נכונות?', detail: 'אחת מהן כמעט תמיד סוטה באחד "השומרים" — השווה אותן זו לזו (לא רק למקור) ומצא במה הן נבדלות. ההבדל הזה הוא המבחן.' },
      { step: 'מבנה מוזר (No sooner... / Had the...)?', detail: 'אלו היפוכים ספרותיים. תרגם לסדר רגיל: "No sooner had X than Y" = מיד אחרי X קרה Y; "Had X been" = If X had been.' },
      { step: 'עברו 2.5 דקות?', detail: 'פסול את מה שברור, בחר מהנותר, סמן והתקדם. עדיף לשמור דקה לשאלה השלישית.' },
    ],
    tipsHref: '/tips/restatement',
    workedExample: {
      prompt: 'Original: "Despite repeated warnings from the safety inspector, the factory continued operating without proper ventilation."',
      options: [
        'The factory ignored the safety warnings and kept working with poor ventilation.',
        'The factory stopped operating after the safety inspector issued repeated warnings.',
        'The safety inspector allowed the factory to work without ventilation.',
        'The factory improved its ventilation after several warnings.',
      ],
      correctIndex: 0,
      walkthrough: [
        'גרעין המקור: מי=המפעל, מה=המשיך לעבוד בלי אוורור תקין, קשר לוגי="Despite" (למרות) = ניגוד בין האזהרות למעשה בפועל.',
        'שומר 1 — כמת/שלילה: אין כימות מיוחד לבדוק כאן, אבל יש כיוון ברור: האזהרות לא מנעו את הפעולה.',
        'שומר 2 — זמן/תוצאה: המקור אומר "continued operating" (המשיך לפעול), לא הפסיק. תשובה 2 ("stopped") הופכת את הכיוון לגמרי — פסילה.',
        'תשובה 3 הופכת תפקידים (המפקח "אישר" במקום "הזהיר") — סותרת את "warnings" במקור. תשובה 4 ("improved") סותרת את "continued... without" — ההפך הגמור.',
        'תשובה 1: "התעלם מהאזהרות והמשיך לעבוד עם אוורור לקוי" — אותו מי, אותו מה, אותו כיוון ניגוד בין האזהרה למעשה. זו הניסוח הנכון.',
      ],
    },
  },
  {
    id: 'reading-comprehension',
    icon: '📚',
    color: 'green',
    titleHe: 'הבנת הנקרא',
    titleEn: 'Reading Comprehension',
    intro:
      'זה הפרק שבו שתי המיומנויות הקודמות (זיהוי קשרים לוגיים דרך מילות קישור, והשוואה מדוקדקת של ניסוחים) מתאחדות ברמת פסקה שלמה, לא רק משפט בודד. ' +
      'ההבדל המכריע בין נבחן שמבזבז זמן לנבחן יעיל הוא סדר הפעולות: הצצה קצרה בשאלות לפני הקריאה נותנת "מפת חיפוש" בראש — כך שבמקום לקרוא את כל הקטע כדי לענות על כל שאלה, קוראים פעם אחת ויודעים מראש לאן לחזור.',
    approach: [
      { step: 'הצץ בשאלות — 30 שניות', detail: 'לא לקרוא לעומק: רק לזהות מילות מפתח ("לפי הקטע, מדוע...") כדי לדעת מה לחפש. אל תקרא עדיין את התשובות.' },
      { step: 'קרא את הקטע ברצף — 4-5 דקות', detail: 'קריאה אחת מלאה ומהירה. אל תעצור על מילה לא מוכרת — סמן אותה בראש והמשך. המטרה: רעיון מרכזי + מה יש בכל פסקה.' },
      { step: 'ענה קודם על שאלות הפרט', detail: 'שאלות "לפי הקטע..." קלות יותר ומחזירות אותך לטקסט. אתר את הפסקה הרלוונטית לפי מילת מפתח וקרא שם 2-3 שורות.' },
      { step: 'שמור את "הרעיון המרכזי" וההסקה לסוף', detail: 'אחרי שענית על הפרטים אתה כבר מכיר את הקטע לעומק — שאלות הכלל נהיות קלות בהרבה.' },
      { step: 'פסול תשובות קיצוניות', detail: 'only / always / never / all — כמעט תמיד שגויות, אלא אם הקטע אמר זאת במפורש. התשובה הנכונה בדרך כלל "מאוזנת".' },
    ],
    stuck: [
      { step: 'לא מוצא את התשובה בקטע?', detail: 'קח מילת מפתח מהשאלה (שם, מספר, מונח) וסרוק את הקטע רק כדי לאתר אותה — אל תקרא הכל מחדש. התשובה תמיד בסביבת מילת המפתח.' },
      { step: 'שאלת הסקה ("ניתן להבין ש...") תקועה?', detail: 'פסול כל תשובה שמשתמשת בידע חיצוני או מגזימה. הנכונה היא תמיד צעד אחד קטן מהטקסט — לא קפיצה.' },
      { step: 'מילה קריטית לא מוכרת בשאלת אוצר מילים?', detail: 'קרא את המשפט שסביבה ושאל מה הגיוני שיהיה שם. אלו שאלות הקשר, לא מילון — הפירוש המילולי הוא לרוב המלכודת.' },
      { step: 'הזמן נגמר ונשארו שאלות?', detail: 'בדקה האחרונה: מלא תשובה לכל שאלה שנותרה לפי "האמצעית והמאוזנת" מבין המסיחים. ריק = 0%, ניחוש מושכל = הרבה יותר.' },
    ],
    tipsHref: '/tips/reading-comprehension',
    workedExample: {
      prompt: 'קטע קצר: "Urban beekeeping has grown rapidly in the past decade. While rooftop hives can boost local pollination, experts caution that overcrowding hives in small areas may increase competition for limited flowers, sometimes harming wild bee populations rather than helping them." שאלה: According to the passage, urban beekeeping —',
      options: [
        'always helps wild bee populations to thrive',
        'can sometimes harm wild bees if hives are too crowded',
        'has been banned in most cities due to overcrowding',
        'is only useful for producing honey commercially',
      ],
      correctIndex: 1,
      walkthrough: [
        'הצצה בשאלה קודם: מילת המפתח היא "urban beekeeping" ו"according to the passage" — שאלת פרט, לא הסקה. מחפשים משפט ספציפי, לא רושם כללי.',
        'קריאת הקטע: המשפט השני מכיל את הניגוד (While = "בעוד ש") — יתרון (האבקה) מול סיכון (תחרות על פרחים, פגיעה בדבורים בר).',
        'תשובה 1 ("always... thrive") — מילת קיצון "always" מול קטע שאומר "may... sometimes" — פסילה מיידית (זה בדיוק המלכודת של תשובות קיצוניות).',
        'תשובה 3 — "banned" (נאסר) לא מוזכר בקטע בכלל — הזיה, לא מידע מהטקסט. תשובה 4 — "only for honey" גם לא מופיע, פרט מומצא.',
        'תשובה 2 — משקפת בדיוק את הניגוד מהמשפט השני: "may... harming wild bee populations" = "can sometimes harm wild bees". זו התשובה הנתמכת ישירות בטקסט.',
      ],
    },
  },
];

/* ─── מילות הקישור — מודול לימודי מלא ─────────────────────────────────────── */

interface ConnectorWord {
  word: string;
  meaning: string;
  grammar: string;
  example: string;
  exampleExplain: string;
}

interface ConnectorCategory {
  id: string;
  title: string;
  icon: string;
  color: string;
  intro: string;
  words: ConnectorWord[];
}

const CONNECTORS_INTRO =
  'שאלת אמירנ"ט לא באמת בודקת אם אתה מכיר את המילה "despite". היא בודקת משהו הרבה יותר בסיסי: האם אתה מזהה את הקשר הלוגי בין שני חלקי המשפט. ' +
  'תחשוב על זה כך — לפני שאתה קורא מילה אחת מהתשובות, המשפט כבר "אמר" לך אם הוא הולך להפתיע אותך (ניגוד), להסביר את עצמו (סיבה-תוצאה), ' +
  'להוסיף על מה שכבר נאמר (תוספת), או להציב דרישה (תנאי). מילת הקישור היא התמרור הזה. מי שלומד לקרוא אותה נכון, פותר חצי מהשאלה עוד לפני שהגיע לפער או לתשובות.';

const CONNECTORS_OUTRO =
  'שימו לב: זו בדיוק אותה מיומנות שחוזרת בשלושת סוגי השאלות, רק בלבוש שונה. בהשלמת משפטים מילת הקישור אומרת לך איזה טון צריך במילה החסרה. ' +
  'בניסוח מחדש היא חלק מ"הגרעין" שאתה מחלץ ממשפט המקור — ואם התשובה משנה בשקט "despite" ל-"because", זו כבר לא אותה טענה. ' +
  'ובהבנת הנקרא היא זו שמסמנת לך איפה הקטע עומד לפנות — קדימה לאותו כיוון, או אחורה נגדו. ברגע שהיא הופכת אוטומטית, שלושת הסוגים נהיים קלים יותר בבת אחת.';

const CONNECTOR_CATEGORIES: ConnectorCategory[] = [
  {
    id: 'contrast',
    title: 'ניגוד',
    icon: '⚡',
    color: 'red',
    intro:
      'קבוצת הניגוד היא הכי נפוצה במבחן, כי היא יוצרת בדיוק את סוג המתח שהופך משפט לשאלה מעניינת: משהו אחד נכון, אבל קורה למרות זאת משהו הפוך או בלתי-צפוי. ' +
      'ברגע שהעין שלך תופסת מילת ניגוד, המשימה הראשונה שלה היא לא להבין את שני חלקי המשפט לעומק — אלא רק לזהות שהם הולכים בכיוונים מנוגדים, ולצפות שהחלק שעדיין לא קראת "יסתור" את מה שכבר קראת. ' +
      'זה חוסך זמן: אתה כבר יודע לאן המשפט הולך לפני שהגעת לשם.',
    words: [
      {
        word: 'although / though',
        meaning: 'אף על פי ש...',
        grammar:
          'אלו מילות חיבור-כפיפה (subordinating conjunctions) — ולכן חייב לבוא אחריהן משפט שלם, עם נושא ופועל משלו: "Although he was tired, he finished the race." ' +
          'זה שונה מהותית מ-despite, ולבלבל ביניהן היא בדיוק המלכודת שהמבחן אוהב לבדוק.',
        example: 'Although the exam was long, most students finished on time.',
        exampleExplain:
          'המשפט פותח ב"although" — סימן שמה שיבוא אחריו (התלמידים סיימו בזמן) הולך לסתור את מה שהיינו מצפים ממנו (מבחן ארוך = כנראה לא מספיקים). זו בדיוק תבנית "ציפייה מול תוצאה" האופיינית לניגוד.',
      },
      {
        word: 'despite / in spite of',
        meaning: 'למרות...',
        grammar:
          'בניגוד ל-although, אלו מילות יחס (prepositions) — ולכן אחריהן חייב לבוא שם עצם או gerund (V-ing), לא משפט שלם. "Despite the rain" נכון; "Despite it rained" שגוי. ' +
          'אם צריך לתאר משפט שלם אחרי despite, פותרים את זה עם "the fact that": "Despite the fact that it rained." זו המלכודת הדקדוקית הכי נפוצה בקבוצת הניגוד — לכן שווה לזכור אותה בנפרד מ-although, גם אם המשמעות דומה.',
        example: 'Despite the heavy rain, the match continued as planned.',
        exampleExplain:
          '"the heavy rain" הוא שם עצם, לא משפט — בדיוק כמו שהכלל מחייב. שימו לב שהמשמעות זהה ל-"Although it rained heavily" — רק המבנה הדקדוקי משתנה.',
      },
      {
        word: 'however',
        meaning: 'אולם / עם זאת',
        grammar:
          'זו מילת קישור בין-משפטית (conjunctive adverb), לא כפיפה — ולכן אינה מחברת ישירות שני חלקי משפט באותו משפט. היא באה אחרי נקודה, או אחרי נקודה-פסיק (;), ולרוב עם פסיק אחריה: "The plan was solid; however, it failed." ' +
          'שימוש שגוי נפוץ הוא לחבר בה שני משפטים ישירות בפסיק בלבד — טעות דקדוקית שהאמירנ"ט בודק דרך שאלות דקדוק.',
        example: 'The results looked promising; however, further testing is required.',
        exampleExplain: 'שני משפטים עצמאיים לגמרי, מחוברים בנקודה-פסיק. "However" רק מסמן שהמשפט השני הולך נגד הרושם שהשאיר המשפט הראשון.',
      },
      {
        word: 'whereas / while',
        meaning: 'בעוד ש... (השוואה מנוגדת)',
        grammar:
          'שונות מ-although ב"עוצמה" — הן לא בהכרח מציגות משהו "רע" מול "טוב", אלא סתם מדגישות הבדל בין שני דברים מקבילים. שימושיות מאוד בשאלות שמשוות בין שתי קבוצות, שני זמנים, או שני מקומות.',
        example: 'The north wing was renovated, whereas the south wing remained untouched.',
        exampleExplain: 'אין כאן "הפתעה" במובן הדרמטי — רק ניגוד עובדתי נקי בין שני חלקי הבניין. זה ההבדל העדין בין whereas ל-although.',
      },
      {
        word: 'nevertheless / nonetheless',
        meaning: 'אף על פי כן',
        grammar: 'מתנהגות דקדוקית בדיוק כמו however (מילות קישור בין-משפטיות), אך נחשבות רשמיות יותר — ולכן נפוצות בעיקר בקטעי הבנת הנקרא ברמה גבוהה, פחות בדיבור.',
        example: 'The evidence was weak; nevertheless, the committee approved the proposal.',
        exampleExplain: 'בדיוק מבנה however — אבל הרישום הרשמי מתאים יותר לטקסט אקדמי, שם תמצאו אותה הכי הרבה.',
      },
    ],
  },
  {
    id: 'cause-effect',
    title: 'סיבה-תוצאה',
    icon: '🔁',
    color: 'blue',
    intro:
      'קבוצה זו מתפצלת לשני תפקידים שחשוב להבדיל ביניהם: מילים שמסמנות את הסיבה (מה שגרם), ומילים שמסמנות את התוצאה (מה שקרה בעקבות זאת). ' +
      'הטעות הנפוצה ביותר בשאלות מהסוג הזה היא להתבלבל בכיוון — לחשוב שמה שבא אחרי "therefore" הוא הגורם, כשלמעשה זו התוצאה. ' +
      'תרגיל מהיר שעובד תמיד: שאלו את עצמכם "מה קרה קודם?" — התשובה לכך היא תמיד הסיבה, לא משנה באיזה סדר המשפט כתוב אותה.',
    words: [
      {
        word: 'because / since / as',
        meaning: 'מכיוון ש... (סיבה)',
        grammar:
          '"Because" הכי חד וברור — משמש רק לסיבה. "Since" ו-"as" עלולות לבלבל כי הן משמשות גם לציון זמן ("Since 2020…" / "As I was walking…") — ההקשר קובע אם מדובר בסיבה או בזמן. ' +
          'בכל שלוש המקרים, המשפט שאחריהן הוא תמיד הגורם למשפט האחר, לא התוצאה.',
        example: 'Because the bridge was closed, traffic was redirected downtown.',
        exampleExplain: 'הגשר הסגור הוא הסיבה; ניתוב התנועה הוא התוצאה. "Because" תמיד "מצביע" על הסיבה בדיוק כך.',
      },
      {
        word: 'therefore / thus / consequently',
        meaning: 'לכן / כתוצאה מכך',
        grammar:
          'ההפך המדויק מ-because מבחינת תפקיד: מה שבא אחריהן הוא ה-effect (התוצאה), לא ה-cause. הסיבה תמיד כבר נאמרה קודם במשפט הקודם. ' +
          'זו הסיבה שכדאי לזכור אותן כזוג-נגד ל-because/since — אותו יחס סיבה-תוצאה, רק שהכיוון הדקדוקי של המשפט הפוך.',
        example: 'The flight was delayed; consequently, passengers missed their connections.',
        exampleExplain: 'העיכוב הוא הסיבה (נאמרה ראשונה); הפספוס של הטיסות המקשרות הוא התוצאה, מסומנת ב-"consequently". בדיוק כיוון הפוך מ-because.',
      },
    ],
  },
  {
    id: 'addition',
    title: 'תוספת',
    icon: '➕',
    color: 'green',
    intro:
      'מילות תוספת הן הכי "בטוחות" מבחינה לוגית — הן פשוט ממשיכות באותו כיוון שכבר התחיל. הכלל הזהב: אם המשפט הראשון היה שלילי, המשך עם "moreover" יהיה גם הוא שלילי (לא הפוך). ' +
      'זו בדיוק הסיבה שהן קלות לזיהוי בטעויות מבחן — כל תשובה שמנסה "להפתיע" אחרי מילת תוספת, כנראה שגויה.',
    words: [
      {
        word: 'moreover / furthermore / in addition',
        meaning: 'יתרה מכך / בנוסף',
        grammar: 'שלושתן מתפקדות כמעט זהה: מוסיפות טיעון נוסף באותו כיוון הרגשי/עובדתי של המשפט הקודם. חילופיות לחלוטין בשימוש היומיומי של רמת האמירנ"ט.',
        example: 'The hotel was overpriced; moreover, the service was disappointing.',
        exampleExplain: 'שתי תלונות, לא תלונה מול שבח. "Moreover" מוודא שאתם לא מצפים לתפנית — רק לעוד באותו כיוון.',
      },
    ],
  },
  {
    id: 'condition',
    title: 'תנאי',
    icon: '🔑',
    color: 'amber',
    intro:
      'מילות תנאי מציבות דרישה: משהו יקרה, אבל רק אם (או רק אם לא) תנאי מסוים מתקיים. ההבדל הקריטי בקבוצה הזו הוא בין תנאי חיובי לתנאי שלילי — ו-"unless" הוא המועד הראשון להתבלבל בו, ' +
      'כי הוא נשמע כמו מילה "רגילה" אבל למעשה מסתיר בתוכו שלילה שלמה.',
    words: [
      {
        word: 'unless',
        meaning: 'אלא אם כן (תנאי שלילי)',
        grammar:
          'שווה-ערך מדויק ל-"if not": "You will fail unless you study" = "You will fail if you do not study." הקושי הוא שהמילה עצמה לא "נשמעת" שלילית — אין בה not או never — ' +
          'ולכן קל לפספס שהיא הופכת את כל התנאי לשלילי. הטריק: בכל פעם שרואים unless, ממירים אותה מיד בראש ל-"if...not" ואז קוראים שוב.',
        example: 'The project will be delayed unless more staff are assigned.',
        exampleExplain: 'זהה ל-"The project will be delayed if more staff are NOT assigned." הפרויקט יתעכב, והדרך היחידה למנוע זאת היא הקצאת עובדים נוספים.',
      },
      {
        word: 'provided that / as long as',
        meaning: 'בתנאי ש...',
        grammar: 'תנאי חיובי ופשוט יותר מ-unless — אין כאן שלילה מוסתרת. מציגות דרישה ברורה: קורה X, בתנאי ש-Y מתקיים.',
        example: 'You may reschedule the exam, provided that you notify the office 48 hours in advance.',
        exampleExplain: 'אפשר לדחות את המבחן — אבל רק אם ההודעה ניתנה 48 שעות מראש. אין כאן שלילה נסתרת כמו ב-unless; הדרישה גלויה וברורה.',
      },
    ],
  },
];

const CATEGORY_COLOR: Record<string, string> = {
  red: 'bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-300',
  blue: 'bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300',
  green: 'bg-green-100 dark:bg-green-900/40 text-green-700 dark:text-green-300',
  amber: 'bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300',
};

const CATEGORY_BORDER: Record<string, string> = {
  red: 'border-red-200 dark:border-red-800',
  blue: 'border-blue-200 dark:border-blue-800',
  green: 'border-green-200 dark:border-green-800',
  amber: 'border-amber-200 dark:border-amber-800',
};

/* ─── איפה כן שווה להשקיע ─────────────────────────────────────────────────── */

const INVEST_INTRO =
  'תקציב הזמן (בנושא "תקציב זמן") קובע גבולות אחידים — אבל בפועל, לא כל דקה חורגת שווה אותו דבר מבחינת הציון. יש שלושה מקומות ספציפיים במבנה המבחן שבהם דקה נוספת באמת משנה תוצאה, ' +
  'ושני אלה שבהם היא רק גוזלת מזמן שאלות אחרות. להכיר את שלושתם משנה איך מחלקים תשומת לב לאורך כל המבחן, לא רק בתוך פרק בודד.';

const INVEST_POINTS = [
  {
    icon: '1️⃣',
    title: 'הפרק הראשון קובע את המסלול',
    body:
      'זה נובע ישירות ממנגנון האדפטיביות (נושא "חוקי המשחק"): האלגוריתם מנתב אותך לרמת הפרק הבא על סמך הביצוע שלך ברגע הזה, ולא מאוחר יותר. ' +
      'טעויות רשלנות בפרק הראשון — כאלה שקורות כי המשפט "נראה קל" ולא הוקדשה לו תשומת לב מלאה — ינתבו אותך למאגר שאלות ברמה נמוכה יותר, ומשם התקרה הכוללת של הציון כבר נמוכה יותר גם אם שאר הפרקים מצוינים. ' +
      'המשמעות: הפרק הראשון דורש את הריכוז הגבוה ביותר במבחן כולו, בדיוק בזמן שהוא הכי "מפתה" להירגע כי הוא בדרך כלל הקל ביותר.',
  },
  {
    icon: '📖',
    title: 'הבנת הנקרא היא בור הזמן הבטוח',
    body:
      '15 דקות זה משמעותית יותר זמן ביחס למספר השאלות מכל פרק אחר (ראה נושא "תקציב זמן"). אם יש שאלה אחת בכל המבחן ששווה לך "להיתקע" עליה 3 דקות שלמות — היא כאן, ולא בהשלמת משפטים שבה אותן 3 דקות היו עולות לך שלוש שאלות אחרות. ' +
      'אבל התנאי קריטי: זה תקף רק אחרי שכל שאר השאלות בפרק כבר קיבלו תשובה. תקיעה מוקדמת על שאלה אחת עדיין מסכנת את היתר.',
  },
  {
    icon: '🧪',
    title: 'הפרק הניסיוני — בונוס בלבד',
    body:
      'זהו פרק נוסף (בדרך כלל השביעי) שטעויות בו לא מורידות נקודות בכלל, ותשובות נכונות בו יכולות להוסיף עד 2 נקודות לציון הסופי — אבל לא יותר. ' +
      'מבחינה טקטית, זה בדיוק ההפך מהפרק הראשון: כאן מגיע מאמץ רגוע. אם הגעת אליו סחוט אחרי פרקים ארוכים, עדיף לנחש ולסיים מהר מאשר "לבזבז" עליו את הריכוז שכבר נשחק — התועלת המקסימלית האפשרית קטנה מדי כדי להצדיק את זה.',
  },
];

/* ─── שיטות מהשוק ─────────────────────────────────────────────────────────── */

const METHODS_INTRO =
  'הצעד הראשון בשיטת העבודה להבנת הנקרא (בנושא "הבנת הנקרא") הוא "הצץ בשאלות" לפני קריאת הקטע — אבל כדאי להבין שזו בחירה מתוך כמה גישות מתחרות שמכוני ההכנה חלוקים לגביהן, ולא "האמת היחידה". ' +
  'הבנת הטרייד-אוף בין הגישות עוזרת להתאים את הטקטיקה לקצב הקריאה האישי שלך, במקום לאמץ שיטה בעיוורון.';

const MARKET_METHODS = [
  {
    title: 'קריאת שאלות לפני הקטע',
    who: 'מוקד אקדמי, TopEnglish',
    fit: 'מתאים אם אתה קורא לאט וחייב קריאה ממוקדת',
    tradeoff: 'חיסרון: קריאה "מחפשת" מפספסת את הרעיון המרכזי, ושאלות הכלל נפגעות.',
  },
  {
    title: 'קריאה מלאה ואז שאלות',
    who: 'הגישה המסורתית',
    fit: 'מתאים לקוראים מהירים עם אנגלית חזקה',
    tradeoff: 'חיסרון: בלי כיוון מוקדם קוראים "בחושך" וחוזרים לקטע יותר פעמים.',
  },
  {
    title: 'המשולב: הצצה קצרה ← קריאה מלאה',
    who: 'ההמלצה שלנו — וכך עובדים רוב המצליחים',
    fit: '30 שניות על השאלות לזיהוי מילות מפתח, ואז קריאה מלאה אחת מהירה',
    tradeoff: 'משלב כיוון + תמונה שלמה. זו השיטה שמובנית בשיטת העבודה של הבנת הנקרא.',
    recommended: true,
  },
];

/* ─── עיצוב ───────────────────────────────────────────────────────────────── */

const COLOR_MAP: Record<string, { bg: string; border: string; badge: string; heading: string; step: string }> = {
  blue: {
    bg: 'bg-blue-50 dark:bg-blue-950/30',
    border: 'border-blue-200 dark:border-blue-800',
    badge: 'bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300',
    heading: 'text-blue-800 dark:text-blue-300',
    step: 'bg-blue-500',
  },
  purple: {
    bg: 'bg-purple-50 dark:bg-purple-950/30',
    border: 'border-purple-200 dark:border-purple-800',
    badge: 'bg-purple-100 dark:bg-purple-900 text-purple-700 dark:text-purple-300',
    heading: 'text-purple-800 dark:text-purple-300',
    step: 'bg-purple-500',
  },
  green: {
    bg: 'bg-emerald-50 dark:bg-emerald-950/30',
    border: 'border-emerald-200 dark:border-emerald-800',
    badge: 'bg-emerald-100 dark:bg-emerald-900 text-emerald-700 dark:text-emerald-300',
    heading: 'text-emerald-800 dark:text-emerald-300',
    step: 'bg-emerald-500',
  },
};

/* ─── ניווט בקוביות ───────────────────────────────────────────────────────── */

type TopicId =
  | 'rules' | 'time' | 'sentence-completion' | 'restatement' | 'reading-comprehension'
  | 'connectors' | 'invest' | 'methods' | 'habits';

const TOPICS: { id: TopicId; icon: string; title: string; desc: string; color: string }[] = [
  { id: 'rules', icon: '🔀', title: 'חוקי המשחק', desc: 'איך המבחן עובד — אדפטיביות, טיימר, ניקוד', color: 'bg-slate-100 dark:bg-slate-700' },
  { id: 'time', icon: '⏱️', title: 'תקציב זמן', desc: 'כמה זמן לכל שאלה, ומתי לוותר ולנחש', color: 'bg-slate-100 dark:bg-slate-700' },
  { id: 'sentence-completion', icon: '✏️', title: 'השלמת משפטים', desc: 'שיטת עבודה + דוגמה פתורה', color: 'bg-blue-50 dark:bg-blue-950/30' },
  { id: 'restatement', icon: '🔄', title: 'ניסוח מחדש', desc: 'שיטת עבודה + דוגמה פתורה', color: 'bg-purple-50 dark:bg-purple-950/30' },
  { id: 'reading-comprehension', icon: '📚', title: 'הבנת הנקרא', desc: 'שיטת עבודה + דוגמה פתורה', color: 'bg-emerald-50 dark:bg-emerald-950/30' },
  { id: 'connectors', icon: '🔗', title: 'מילות קישור', desc: '10 המילים שקובעות כמעט כל שאלה', color: 'bg-amber-50 dark:bg-amber-950/30' },
  { id: 'invest', icon: '💎', title: 'איפה שווה להשקיע', desc: 'לא כל הדקות שוות באותה מידה', color: 'bg-slate-100 dark:bg-slate-700' },
  { id: 'methods', icon: '📖', title: 'שיטות קריאה', desc: 'מה מכוני ההכנה ממליצים — ולמה', color: 'bg-slate-100 dark:bg-slate-700' },
  { id: 'habits', icon: '✅', title: 'הרגלי הכנה', desc: 'מה עובד באמת, לפי כל המכונים', color: 'bg-slate-100 dark:bg-slate-700' },
];

/* ─── תצוגת טקסט קריאה — מפרק פסקאות ארוכות למשפטים נפרדים, ומדגיש את
   המסקנה המעשית (אם המחבר סימן אותה במפורש) כתיבת "בשורה תחתונה" נבדלת ───── */

const TAKEAWAY_MARKERS = [
  'המסקנה המעשית:', 'המסקנה החד-משמעית:', 'המסקנה:',
  'הכלל הזהב:', 'הטריק:', 'שימו לב:', 'זכרו:', 'תרגיל מהיר שעובד תמיד:',
];

function splitIntoSentences(text: string): string[] {
  return text
    .split(/(?<=[.!?])\s+(?=\S)/)
    .map(s => s.trim())
    .filter(Boolean);
}

const TONE_CLASS: Record<'intro' | 'body' | 'muted', string> = {
  intro: 'text-sm text-slate-700 dark:text-slate-200 leading-relaxed',
  body: 'text-sm text-slate-600 dark:text-slate-300 leading-relaxed',
  muted: 'text-xs text-slate-500 dark:text-slate-400 leading-relaxed',
};

function TextBlock({ text, tone = 'body' }: { text: string; tone?: 'intro' | 'body' | 'muted' }) {
  const pClass = TONE_CLASS[tone];
  const markerIdx = TAKEAWAY_MARKERS
    .map(m => text.indexOf(m))
    .filter(i => i !== -1)
    .sort((a, b) => a - b)[0];

  const lead = markerIdx !== undefined ? text.slice(0, markerIdx).trim() : text;
  const takeaway = markerIdx !== undefined ? text.slice(markerIdx).trim() : null;
  const leadSentences = splitIntoSentences(lead);

  return (
    <div>
      {leadSentences.map((s, i) => (
        <p key={i} className={`${pClass} ${i < leadSentences.length - 1 ? 'mb-1.5' : ''}`}>{s}</p>
      ))}
      {takeaway && (
        <div className="mt-2 flex items-start gap-2 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-xl px-3 py-2">
          <span className="text-sm flex-shrink-0 mt-0.5">💡</span>
          <p className="text-slate-800 dark:text-slate-100 text-sm leading-relaxed font-medium">{takeaway}</p>
        </div>
      )}
    </div>
  );
}

function QuestionGuideDetail({ guide }: { guide: QuestionGuide }) {
  const colors = COLOR_MAP[guide.color];
  return (
    <div>
      <div className="flex items-center gap-3 mb-4">
        <div className={`w-12 h-12 rounded-xl flex items-center justify-center text-2xl ${colors.badge}`}>{guide.icon}</div>
        <div>
          <h1 className="text-xl font-black text-slate-900 dark:text-white leading-tight">{guide.titleHe}</h1>
          <span className="text-xs text-slate-400 dark:text-slate-500 font-medium">{guide.titleEn}</span>
        </div>
      </div>

      <div className="mb-4 bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 p-4">
        <TextBlock text={guide.intro} tone="intro" />
      </div>

      <div className={`rounded-2xl border ${colors.bg} ${colors.border} p-4 mb-3`}>
        <h4 className={`font-bold text-sm mb-3 ${colors.heading}`}>🧭 כך ניגשים לשאלה:</h4>
        <ol className="space-y-3">
          {guide.approach.map((s, i) => (
            <li key={i} className="flex items-start gap-2.5">
              <span className={`w-5 h-5 rounded-full ${colors.step} text-white text-[11px] font-bold flex items-center justify-center flex-shrink-0 mt-0.5`}>{i + 1}</span>
              <div>
                <span className="font-semibold text-slate-800 dark:text-slate-100 text-sm">{s.step}</span>
                <p className="text-slate-600 dark:text-slate-300 text-xs leading-relaxed mt-0.5">{s.detail}</p>
              </div>
            </li>
          ))}
        </ol>
      </div>

      <div className="rounded-2xl border border-orange-200 dark:border-orange-800 bg-orange-50 dark:bg-orange-950/30 p-4 mb-3">
        <h4 className="font-bold text-sm mb-3 text-orange-800 dark:text-orange-300">🆘 נתקעת? פרוטוקול החילוץ:</h4>
        <div className="space-y-3">
          {guide.stuck.map((s, i) => (
            <div key={i} className="flex items-start gap-2.5">
              <span className="text-orange-400 flex-shrink-0 mt-0.5 text-sm">◄</span>
              <div>
                <span className="font-semibold text-slate-800 dark:text-slate-100 text-sm">{s.step}</span>
                <p className="text-slate-600 dark:text-slate-300 text-xs leading-relaxed mt-0.5">{s.detail}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-4 mb-3">
        <h4 className="font-bold text-sm mb-3 text-slate-800 dark:text-slate-100">📝 דוגמה מלאה עם פתרון צעד-אחר-צעד:</h4>
        <p dir="ltr" className="text-sm text-slate-800 dark:text-slate-100 leading-relaxed mb-3 font-medium">
          {guide.workedExample.prompt}
        </p>
        <div dir="ltr" className="grid grid-cols-1 sm:grid-cols-2 gap-2 mb-4">
          {guide.workedExample.options.map((opt, i) => (
            <div
              key={i}
              className={`px-3 py-2 rounded-lg text-sm border ${
                i === guide.workedExample.correctIndex
                  ? 'border-green-400 bg-green-50 dark:bg-green-950/30 text-green-800 dark:text-green-300 font-semibold'
                  : 'border-slate-200 dark:border-slate-700 text-slate-500 dark:text-slate-400'
              }`}
            >
              {i + 1}. {opt} {i === guide.workedExample.correctIndex && '✓'}
            </div>
          ))}
        </div>
        <ol className="space-y-2">
          {guide.workedExample.walkthrough.map((line, i) => (
            <li key={i} className="flex items-start gap-2 text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
              <span className="text-slate-300 dark:text-slate-600 flex-shrink-0 font-mono">{i + 1}.</span>
              <span>{line}</span>
            </li>
          ))}
        </ol>
      </div>

      <Link href={guide.tipsHref} className={`inline-block text-xs font-semibold ${colors.heading} hover:underline`}>
        ← לטיפים המורחבים והמלכודות של {guide.titleHe}
      </Link>
    </div>
  );
}

export default function StrategiesPage() {
  const [topic, setTopic] = useState<TopicId | null>(null);

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-900 pb-24" dir="rtl">
      <BackNav backHref="/" backLabel="דף הבית" />

      {/* Header */}
      <div className="bg-white dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 px-4 py-5">
        <h1 className="text-2xl font-black text-slate-900 dark:text-white">🧠 המדריך המלא לפתרון האמירנ"ט</h1>
        <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
          בחר נושא — כל נושא ממוקד ומהיר לגלילה
        </p>
      </div>

      <div className="max-w-2xl mx-auto px-4 py-6">
        {topic === null ? (
          /* ── מסך הקוביות ── */
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {TOPICS.map(t => (
              <button
                key={t.id}
                onClick={() => setTopic(t.id)}
                className={`${t.color} rounded-2xl border border-slate-200 dark:border-slate-700 p-4 text-right hover:shadow-md hover:-translate-y-0.5 transition-all flex flex-col gap-1.5`}
              >
                <span className="text-2xl">{t.icon}</span>
                <span className="font-bold text-slate-900 dark:text-white text-sm leading-tight">{t.title}</span>
                <span className="text-[11px] text-slate-500 dark:text-slate-400 leading-snug">{t.desc}</span>
              </button>
            ))}
          </div>
        ) : (
          /* ── תצוגת נושא בודד ── */
          <div>
            <button
              onClick={() => setTopic(null)}
              className="text-sm text-slate-400 dark:text-slate-500 hover:text-slate-700 dark:hover:text-slate-200 mb-5 flex items-center gap-1"
            >
              ← כל הנושאים
            </button>

            {topic === 'rules' && (
              <section>
                <h2 className="text-lg font-black text-slate-900 dark:text-white mb-3">חוקי המשחק</h2>
                <div className="mb-5 bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 p-4">
                  <TextBlock text={RULES_INTRO} tone="intro" />
                </div>
                <div className="space-y-4">
                  {GAME_RULES.map(rule => (
                    <div key={rule.title} className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 p-4 flex items-start gap-3">
                      <span className="text-2xl flex-shrink-0">{rule.icon}</span>
                      <div className="flex-1 min-w-0">
                        <h3 className="font-bold text-slate-900 dark:text-white text-sm mb-1.5">{rule.title}</h3>
                        <TextBlock text={rule.body} tone="body" />
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            )}

            {topic === 'time' && (
              <section>
                <h2 className="text-lg font-black text-slate-900 dark:text-white mb-3">תקציב הזמן שלך — כולל "תקציב תקיעה"</h2>
                <div className="mb-5 bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 p-4">
                  <TextBlock text={TIME_INTRO} tone="intro" />
                </div>
                <div className="space-y-3">
                  {TIME_BUDGET.map(row => (
                    <div key={row.section} className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 p-4">
                      <div className="flex items-center justify-between mb-2">
                        <h3 className="font-bold text-slate-900 dark:text-white text-sm">{row.section}</h3>
                        <span className="text-xs font-mono bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 px-2 py-1 rounded-lg">{row.total}</span>
                      </div>
                      <div className="grid grid-cols-2 gap-2 mb-2">
                        <div className="bg-slate-50 dark:bg-slate-700/50 rounded-xl px-3 py-2">
                          <div className="text-[11px] text-slate-400 dark:text-slate-500">זמן לשאלה</div>
                          <div className="text-sm font-bold text-slate-800 dark:text-slate-100">{row.perQ}</div>
                        </div>
                        <div className="bg-orange-50 dark:bg-orange-950/30 rounded-xl px-3 py-2">
                          <div className="text-[11px] text-orange-400">מקסימום תקיעה</div>
                          <div className="text-sm font-bold text-orange-700 dark:text-orange-300">{row.stuckCap}</div>
                        </div>
                      </div>
                      <TextBlock text={row.note} tone="muted" />
                    </div>
                  ))}
                </div>
              </section>
            )}

            {(topic === 'sentence-completion' || topic === 'restatement' || topic === 'reading-comprehension') && (
              <QuestionGuideDetail guide={QUESTION_GUIDES.find(g => g.id === topic)!} />
            )}

            {topic === 'connectors' && (
              <section>
                <h2 className="text-lg font-black text-slate-900 dark:text-white mb-3">מילות הקישור שקובעות הכל</h2>

                <div className="mb-6 bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 p-4">
                  <TextBlock text={CONNECTORS_INTRO} tone="intro" />
                </div>

                <div className="space-y-8">
                  {CONNECTOR_CATEGORIES.map(cat => (
                    <div key={cat.id}>
                      <div className="flex items-center gap-2.5 mb-2">
                        <span className={`w-9 h-9 rounded-xl flex items-center justify-center text-lg ${CATEGORY_COLOR[cat.color]}`}>{cat.icon}</span>
                        <h3 className="font-black text-slate-900 dark:text-white text-base">{cat.title}</h3>
                      </div>
                      <div className="mb-3">
                        <TextBlock text={cat.intro} tone="body" />
                      </div>

                      <div className={`space-y-4 border-r-2 ${CATEGORY_BORDER[cat.color]} pr-4`}>
                        {cat.words.map(w => (
                          <div key={w.word}>
                            <div className="flex items-baseline gap-2 flex-wrap mb-1">
                              <span dir="ltr" className="font-bold text-slate-900 dark:text-white text-sm">{w.word}</span>
                              <span className="text-slate-400 dark:text-slate-500 text-xs">— {w.meaning}</span>
                            </div>
                            <div className="mb-2">
                              <TextBlock text={w.grammar} tone="body" />
                            </div>
                            <p dir="ltr" className="text-sm text-slate-800 dark:text-slate-100 italic bg-slate-50 dark:bg-slate-700/50 rounded-lg px-3 py-1.5 mb-1.5">
                              {w.example}
                            </p>
                            <TextBlock text={w.exampleExplain} tone="muted" />
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>

                <div className="mt-6 bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800 rounded-2xl p-4">
                  <TextBlock text={CONNECTORS_OUTRO} tone="intro" />
                </div>
              </section>
            )}

            {topic === 'invest' && (
              <section>
                <h2 className="text-lg font-black text-slate-900 dark:text-white mb-3">איפה כן שווה "להיתקע"</h2>
                <div className="mb-5 bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 p-4">
                  <TextBlock text={INVEST_INTRO} tone="intro" />
                </div>
                <div className="space-y-3">
                  {INVEST_POINTS.map(p => (
                    <div key={p.title} className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 p-4 flex items-start gap-3">
                      <span className="text-xl flex-shrink-0">{p.icon}</span>
                      <div className="flex-1 min-w-0">
                        <h3 className="font-bold text-slate-900 dark:text-white text-sm mb-1">{p.title}</h3>
                        <TextBlock text={p.body} tone="body" />
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            )}

            {topic === 'methods' && (
              <section>
                <h2 className="text-lg font-black text-slate-900 dark:text-white mb-3">שיטות הקריאה בשוק — ומה אנחנו ממליצים</h2>
                <div className="mb-5 bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 p-4">
                  <TextBlock text={METHODS_INTRO} tone="intro" />
                </div>
                <div className="space-y-3">
                  {MARKET_METHODS.map(m => (
                    <div
                      key={m.title}
                      className={`rounded-2xl border p-4 ${
                        m.recommended
                          ? 'bg-green-50 dark:bg-green-950/30 border-green-300 dark:border-green-700 ring-1 ring-green-300 dark:ring-green-700'
                          : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700'
                      }`}
                    >
                      <div className="flex items-center gap-2 mb-1">
                        <h3 className="font-bold text-slate-900 dark:text-white text-sm">{m.title}</h3>
                        {m.recommended && (
                          <span className="text-[10px] font-bold bg-green-500 text-white px-2 py-0.5 rounded-full">מומלץ</span>
                        )}
                      </div>
                      <div className="text-xs text-slate-400 dark:text-slate-500 mb-2">{m.who}</div>
                      <p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed mb-1">{m.fit}</p>
                      <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">{m.tradeoff}</p>
                    </div>
                  ))}
                </div>
              </section>
            )}

            {topic === 'habits' && (
              <section>
                <h2 className="text-lg font-black text-slate-900 dark:text-white mb-3">ההכנה שעובדת (לפי כל המכונים)</h2>
                <div className="mb-5 bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 p-4">
                  <TextBlock
                    text='כל השיטות שראית עד כה (מילות קישור, שיטות עבודה לפי סוג, תזמון) הן מיומנויות — ומיומנות לא נקבעת בפעם אחת, היא נבנית בחזרות. ארבעת ההרגלים הבאים לא מחליפים את הידע האסטרטגי, אלא הופכים אותו לאוטומטי, כך שביום המבחן אתה לא צריך "לחשוב" על השיטה — אתה פשוט מיישם אותה.'
                    tone="intro"
                  />
                </div>
                <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 divide-y divide-slate-100 dark:divide-slate-700">
                  {[
                    { icon: '📚', text: '20 דקות קריאה באנגלית כל יום — טקסט לא קל מדי ולא קשה מדי. זו ההמלצה המשותפת לכל המכונים, כי היא בונה זיהוי דפוסי משפט (כולל מילות קישור) באופן טבעי, בלי לשנן בכוח.' },
                    { icon: '🔗', text: 'שינון מילות קישור — הן מופיעות בכל שלושת סוגי השאלות, ולכן הן ה"מכפיל כוח" היחיד שמשפר בבת אחת גם השלמת משפטים, גם ניסוח מחדש, וגם הבנת הנקרא. תרגל את חבילת 208 המחברים באוצר המילים.', href: '/vocabulary?pack=connectors', cta: 'לתרגול המחברים ←' },
                    { icon: '⏱️', text: 'סימולציות בתנאי אמת עם טיימר — ההבדל בין לדעת אנגלית ובין לדעת להיבחן הוא בדיוק תרגול תחת אותם חוקי משחק (טיימר קשיח, נעילת פרקים) שראית קודם. מבחן מלא כאן באתר = בדיוק זה.', href: '/exam', cta: 'למבחן מלא ←' },
                    { icon: '🔁', text: 'חזרה על טעויות — כל שאלה שטעית בה נכנסת אצלנו לתור החזרה החכמה, ומופיעה שוב בדיוק כשאתה עומד לשכוח אותה. 10 דקות של חזרה כאלה שוות יותר מ-50 שאלות חדשות, כי הן תוקפות פער ספציפי שכבר זוהה.', href: '/review-queue', cta: 'לתור החזרה ←' },
                  ].map((h, i) => (
                    <div key={i} className="flex items-start gap-3 p-4">
                      <span className="text-xl flex-shrink-0">{h.icon}</span>
                      <div>
                        <p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed">{h.text}</p>
                        {h.href && (
                          <Link href={h.href} className="inline-block mt-1.5 text-xs font-bold text-blue-600 dark:text-blue-400 hover:underline">
                            {h.cta}
                          </Link>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            )}

            {/* CTA */}
            <div className="bg-blue-600 rounded-2xl p-5 text-center mt-8">
              <p className="text-white font-bold mb-3">התיאוריה ברורה? עכשיו מיישמים.</p>
              <div className="flex gap-3 justify-center">
                <Link href="/exam" className="px-5 py-2.5 bg-white text-blue-700 rounded-xl text-sm font-bold hover:bg-blue-50 transition-colors">
                  🎯 מבחן מלא
                </Link>
                <Link href="/practice" className="px-5 py-2.5 bg-blue-500 text-white rounded-xl text-sm font-bold hover:bg-blue-400 transition-colors">
                  ✏️ תרגול ממוקד
                </Link>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
