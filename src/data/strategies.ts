/**
 * Single source of truth for all strategy content — the /strategies guide and
 * the /tips/* deep-dive pages both render from here, so a correction made once
 * shows up everywhere.
 *
 * Inline emphasis: wrap text in **double asterisks** (rendered by <RichText>).
 */
import {
  Shuffle, DoorClosed, Timer, Dices, PenLine, RotateCcw, BookOpen,
  Zap, Plus, KeyRound, Route, FlaskConical, Link2, Gem, CheckCircle2, Compass,
  type LucideIcon,
} from 'lucide-react';

export type QuestionTypeId = 'sentence-completion' | 'restatement' | 'reading-comprehension';

/* ─── חוקי המשחק ──────────────────────────────────────────────────────────── */

export const RULES_INTRO =
  'הרוב המכריע של הנקודות שנבחנים מפסידים באמירנ"ט לא נופל בגלל חוסר ידע באנגלית — הוא נופל בגלל שהם לא ידעו איך המנגנון עצמו עובד, והתנהגו לפי אינסטינקטים ממבחנים "רגילים" שלא מתאימים כאן. ' +
  'המבחן הזה בנוי על שלושה מנגנונים ייחודיים (אדפטיביות, נעילת פרקים, וטיימר קשיח) שכל אחד מהם דורש התנהגות שונה מהמצופה. הכר אותם קודם — הם ישפיעו על כל החלטה טקטית שתקבל בהמשך.';

export const GAME_RULES: { icon: LucideIcon; title: string; body: string }[] = [
  {
    icon: Shuffle,
    title: 'המבחן אדפטיבי — קושי עולה = סימן טוב',
    body:
      'המבחן לא שואל את כל הנבחנים את אותן שאלות. לאורך המבחן, מנוע אדפטיבי מעריך מחדש את הרמה שלך על סמך מה שענית, ובוחר את רמת הקושי של הפרק הבא בהתאם. ' +
      'האבחון והתרגול המעורב באתר מבוססים על אותם עקרונות פסיכומטריים אדפטיביים (IRT) שמניעים את המבחן הרשמי — לא על האלגוריתם הפנימי המדויק שלו, שאינו מפורסם. ' +
      'המשמעות: אם הפרק הבא מרגיש לך קשה יותר, זה לא סימן שאתה "נכשל" — זה בדיוק ההפך: המנוע זיהה שאתה מתפקד ברמה גבוהה, ומעלה את הרף כדי למדוד אותך בדיוק. ' +
      'נבחן שנבהל מקושי עולה ומתחיל לפעול פחות בביטחון, פוגע בעצמו פעמיים — גם בציון וגם באיכות הריכוז. הציונים הגבוהים ביותר (120+) מגיעים דרך פרקים קשים, ולכן קושי עולה הוא בדיוק המסלול שאתה רוצה להיות בו.',
  },
  {
    icon: DoorClosed,
    title: 'אין חזרה אחורה בין פרקים',
    body:
      'ברגע שפרק נסגר — בלחיצה מכוונת או כשהטיימר מגיע לאפס — אי אפשר לחזור אליו, בשום שלב, גם לא בסוף המבחן. זה שונה ממבחנים "רגילים" שבהם מותר לדפדף אחורה חופשי עד הסוף. ' +
      'בתוך פרק בודד, לעומת זאת, יש חופש מלא לנוע בין השאלות — כך שהאסטרטגיה הנכונה היא לנצל את החופש הזה בתוך הפרק (לדלג על שאלה קשה ולחזור אליה) ולא לסמוך עליו בין פרקים. ' +
      'המסקנה המעשית: לפני שאתה עוזב פרק — בין אם בלחיצה או כי הזמן עומד להיגמר — עשה סבב אחרון מהיר לוודא שלכל שאלה יש תשובה כלשהי מסומנת, גם אם היא ניחוש.',
  },
  {
    icon: Timer,
    title: 'טיימר קשיח לכל פרק — וזמן לא עובר הלאה',
    body:
      'לכל פרק הקצאת זמן נפרדת ומוחלטת (4 / 6 / 15 דקות בהתאם לסוג), והיא לא מצטברת: אם סיימת פרק מוקדם, שארית הזמן נעלמת — היא לא עוברת לפרק הבא. ' +
      'זו הסיבה שאסור "לחסוך" זמן במודע כדי "להעביר" אותו קדימה — זו אשליה. הדרך הנכונה לנצל זמן שנותר היא לחזור באותו רגע לשאלות שסימנת כלא-בטוחות בפרק הנוכחי, ולבדוק אותן שוב, כי ברגע שנסגר הפרק — הן הלכו.',
  },
  {
    icon: Dices,
    title: 'אין קנס על טעות — מנחשים תמיד',
    body:
      'בניגוד למבחנים שיש בהם ניקוד שלילי על טעות (שם ניחוש עיוור מסוכן), באמירנ"ט שאלה ריקה ושאלה שגויה שוות בדיוק אותו דבר: אפס נקודות. אבל שאלה עם ניחוש עיוור מקנה 25% סיכוי סטטיסטי לצדק — ואם הצלחת לפסול מסיח אחד לפני שניחשת, הסיכוי קופץ ל-33%, ושניים פסולים מביאים אותך ל-50%. ' +
      'המסקנה החד-משמעית: אין שום תרחיש שבו כדאי להשאיר שאלה ריקה. גם ניחוש עיוור לגמרי, בלי לפסול כלום, עדיף אינסופית על פני להשאיר אותה ריקה.',
  },
];

/* ─── תקציב זמן ───────────────────────────────────────────────────────────── */

export const TIME_INTRO =
  'בגלל שהטיימר קשיח והזמן לא עובר בין פרקים (כמו שראית בנושא "חוקי המשחק"), תזמון הוא לא עניין של משמעת אישית — הוא חלק מהחוק הפיזי של המבחן. ' +
  'ההבדל בין נבחן טוב לבינוני הוא לא כמות הידע באנגלית, אלא זה: הטוב מחליט מראש, לפני שהוא בכלל רואה שאלה, כמה זמן מותר לו "להיתקע" על כל שאלה בכל סוג — ועומד בהחלטה הזו גם כשההתקעות מרגישה אישית ומתסכלת. ' +
  'המספרים למטה בנויים כך שאם תעמוד בהם, יישאר לך תמיד זמן לסבב בדיקה אחרון לפני סגירת הפרק.';

export interface TimeBudgetRow {
  id: QuestionTypeId;
  section: string;
  total: string;
  perQ: string;
  stuckCap: string;
  note: string;
}

export const TIME_BUDGET: TimeBudgetRow[] = [
  {
    id: 'sentence-completion',
    section: 'השלמת משפטים',
    total: '4 דק׳ / 4 שאלות',
    perQ: '~60 שניות',
    stuckCap: 'עד 90 שניות',
    note:
      'זהו הפרק הכי "יקר לדקה" — כל שאלה שקולה ל-25% מהפרק כולו, וכל אחת עומדת בפני עצמה, כך שזמן שנשרף על אחת נלקח ישירות מהאחרות. בגלל זה תקציב התקיעה קצר יחסית: שאלה שלא נפתרה תוך דקה וחצי כנראה לא תיפתר גם בעוד דקה נוספת. ' +
      'ברגע שעוברים את דקה וחצי — פוסלים מה שאפשר בזריזות, מנחשים, ומתקדמים בלי חרטה.',
  },
  {
    id: 'restatement',
    section: 'ניסוח מחדש',
    total: '6 דק׳ / 3 שאלות',
    perQ: '~2 דקות',
    stuckCap: 'עד 2.5 דקות',
    note:
      'כ-2 דקות לשאלה — פי שניים מהשלמת משפטים, ובערך אותו זמן לשאלה שנשאר בהבנת הנקרא אחרי הקריאה. הזמן הזה לא מקרי: משפטי המקור בניסוח מחדש דורשים פירוק מדוקדק (שמונת "השומרים" שמופיעים בנושא ניסוח מחדש), וזה תהליך שדורש קריאה חוזרת. ' +
      'נצל אותו: זה הפרק שבו כדאי להשוות שיטתית כל מסיח מול משפט המקור, ולא רק לבחור לפי "הרגשה".',
  },
  {
    id: 'reading-comprehension',
    section: 'הבנת הנקרא',
    total: '15 דק׳ / 5 שאלות',
    perQ: '~4 דק׳ קריאה + ~2 דק׳ לשאלה',
    stuckCap: 'עד 3 דקות — רק בסבב השני',
    note:
      'החשבון צפוף: 4 דקות קריאה + 5 שאלות × 2 דקות = 14 דקות, כלומר נשארת רק כדקה של מרווח. לכן הקריאה הראשונית חייבת להיות מהירה, ואין מקום להיתקע על שאלה מוקדם. ' +
      'מה שכן גמיש כאן: שאלות פרט נפתרות לרוב בפחות מ-2 דקות (הקטע כבר מוכר לך), והזמן שנחסך בהן מצטבר בתוך הפרק. זה התקציב היחיד לשאלה תקועה — ולכן דוחים אותה לסבב שני, אחרי שכל השאר קיבלו תשובה.',
  },
];

export const TIME_BY_TYPE: Record<QuestionTypeId, TimeBudgetRow> =
  Object.fromEntries(TIME_BUDGET.map(r => [r.id, r])) as Record<QuestionTypeId, TimeBudgetRow>;

/* ─── כללים בשלוש שכבות: כלל → למה → דוגמה ──────────────────────────────────
   Progressive disclosure lives in the data: the UI shows `rule` by default,
   reveals `why` on demand, and `example` as the deepest layer. Keep `rule` to
   one short line — it is the only part many students will ever read. */

/** A minimal pair: source, a faithful restatement, and a distractor that differs in exactly one respect. */
export interface MinimalPair {
  kind: 'pair';
  source: string;
  correct: string;
  trap: string;
  /** What the trap changed — the one thing to notice. */
  note: string;
  /**
   * The exact phrases to highlight in each sentence — authored, not diffed:
   * a faithful paraphrase changes many words, but only these carry the guard.
   * Each phrase must appear verbatim in its sentence (strategies.test.ts).
   */
  highlight: { source: string[]; correct: string[]; trap: string[] };
}

/** A decision scenario, for rules that are about behavior rather than wording. */
export interface Scenario {
  kind: 'scenario';
  text: string;
}

export interface LayeredRule {
  id: string;
  /** Short label (chip / list title). */
  title: string;
  /** Layer 1 — the rule itself, one line. */
  rule: string;
  /** Layer 2 — why it holds and how the exam exploits it. */
  why: string;
  /** Layer 3 — a worked minimal pair or scenario. */
  example: MinimalPair | Scenario;
  /** Where an empirical claim in `why` comes from. */
  source?: string;
}

/**
 * The restatement "guards": the dimensions a distractor changes while keeping
 * topic and most of the wording. A faithful restatement preserves all eight.
 */
export const RESTATEMENT_GUARDS: LayeredRule[] = [
  {
    id: 'quantifier',
    title: 'כמת',
    rule: 'all / most / some / few / none — כמת ששונה הוא משפט אחר.',
    why: 'הכמת קובע על כמה מהנושא הטענה חלה. מסיח טיפוסי משאיר את כל המשפט כמו שהוא ומחליף רק את הכמת — "רוב" הופך ל"כולם", "מעטים" ל"אף אחד". מילים נרדפות לכמת (most = the majority) כשרות; כמת בעוצמה אחרת — לא.',
    example: {
      kind: 'pair',
      source: 'Most of the participants reported improved sleep.',
      correct: 'The majority of participants said that their sleep had improved.',
      trap: 'All of the participants said that their sleep had improved.',
      note: 'most → the majority שומר על הכמות; all מכליל את הטענה על כולם.',
      highlight: { source: ['Most'], correct: ['The majority'], trap: ['All'] },
    },
  },
  {
    id: 'negation',
    title: 'שלילה',
    rule: 'ספור את השלילות — ואז בדוק גם את העוצמה.',
    why: 'שלילה מופיעה לא רק ב-not ו-never, אלא גם בתחיליות (un-, in-, dis-) ובמילים כמו hardly, rarely, fail to. שתי שלילות הופכות את הכיוון בחזרה, אבל לא משחזרות את העוצמה: "not unexpected" פירושו "צפוי במידה מסוימת", לא "צפוי לחלוטין".',
    example: {
      kind: 'pair',
      source: "The committee's decision was not unexpected.",
      correct: "The committee's decision was, to some extent, predictable.",
      trap: "Everyone knew in advance exactly what the committee would decide.",
      note: 'הכיוון נכון (צפוי), אבל "everyone knew exactly" מגזים — לשון המעטה אינה ודאות.',
      highlight: { source: ['not unexpected'], correct: ['to some extent, predictable'], trap: ['Everyone knew in advance exactly'] },
    },
  },
  {
    id: 'time',
    title: 'זמן ורצף',
    rule: 'before / after / until / since — מה קרה קודם?',
    why: 'ניסוח מחדש משנה לעיתים קרובות את סדר המילים בלי לשנות את סדר האירועים ("Only after X did Y" = Y קרה אחרי X). המסיח עושה את ההפך: שומר על סדר המילים ומחליף את סדר האירועים, או הופך פעולה שהסתיימה לפעולה שעדיין נמשכת.',
    example: {
      kind: 'pair',
      source: 'Not until the bridge was repaired did traffic return to normal.',
      correct: 'Traffic returned to normal only after the bridge had been repaired.',
      trap: 'Traffic returned to normal before the repairs to the bridge were finished.',
      note: '"Not until X did Y" = Y רק אחרי X. ה-trap מקדים את Y ל-X.',
      highlight: { source: ['Not until'], correct: ['only after'], trap: ['before'] },
    },
  },
  {
    id: 'direction',
    title: 'כיוון הקשר',
    rule: 'מה גרם למה, ומה קרה למרות מה? הכיוון חייב להישמר.',
    why: 'שני האירועים יכולים להופיע במסיח בדיוק כמו במקור — ורק החץ ביניהם מתהפך: הסיבה הופכת לתוצאה, או ניגוד (despite) הופך לסיבה (because). unless הוא תנאי שלילי מוסתר: = if … not.',
    example: {
      kind: 'pair',
      source: 'The factory closed because demand for its products fell.',
      correct: "Falling demand for its products led to the factory's closure.",
      trap: 'Demand for its products fell because the factory closed.',
      note: 'אותם שני אירועים, חץ סיבתי הפוך.',
      highlight: { source: ['because demand for its products fell'], correct: ['Falling demand', 'led to'], trap: ['because the factory closed'] },
    },
  },
  {
    id: 'modality',
    title: 'מודאליות',
    rule: 'may ≠ will ≠ must — שמור על עוצמת הוודאות.',
    why: 'פעלים מודאליים ומילות הסתייגות (may, might, could, likely, suggests, is believed to) קובעים עד כמה הטענה ודאית. מסיח שהופך "עשוי" ל"יקרה" או "מרמז" ל"מוכיח" שומר על הנושא ועל הכיוון — ולכן קל לפספס אותו. זו מלכודת קלאסית במשפטים בסגנון אקדמי.',
    example: {
      kind: 'pair',
      source: 'The new drug may reduce the risk of heart disease.',
      correct: 'The new drug could possibly lower the risk of heart disease.',
      trap: 'The new drug will reduce the risk of heart disease.',
      note: 'may (אפשרות) הפך ל-will (ודאות). אותו נושא, אותו כיוון — עוצמה אחרת.',
      highlight: { source: ['may'], correct: ['could possibly'], trap: ['will'] },
    },
  },
  {
    id: 'counterfactual',
    title: 'תנאי שלא התקיים',
    rule: 'Had X… / If X had… would have — פירושו ש-X לא קרה.',
    why: 'תנאי בעבר שלא התקיים מתאר את ההפך מהמציאות: גם התנאי וגם התוצאה לא קרו. "Had the company invested…" = החברה לא השקיעה. המסיח לוקח את התנאי כעובדה. אותו עיקרון בהווה: "If he were taller" = הוא לא גבוה.',
    example: {
      kind: 'pair',
      source: 'Had the company invested in safety, the accident would have been prevented.',
      correct: 'The company failed to invest in safety, and as a result the accident was not prevented.',
      trap: 'The company invested in safety, so the accident was prevented.',
      note: 'ה-trap הופך את התנאי ההיפותטי לעובדה — בדיוק ההפך מהמקור.',
      highlight: { source: ['Had the company invested'], correct: ['failed to invest'], trap: ['The company invested'] },
    },
  },
  {
    id: 'comparison',
    title: 'השוואה',
    rule: 'יותר / פחות / הכי / כמו — מי גדול ממי?',
    why: 'השוואה אפשר לנסח מחדש בהיפוך ("A older than B" = "B younger than A") או במעבר בין מבנים ("No other X is as big as Z" = "Z is the biggest X"). המסיח הופך את כיוון ההשוואה, או הופך יתרון לשוויון.',
    example: {
      kind: 'pair',
      source: 'No other planet in the solar system is as large as Jupiter.',
      correct: 'Jupiter is the largest planet in the solar system.',
      trap: 'Jupiter is about the same size as the other planets in the solar system.',
      note: '"No other … as large as" = הכי גדול. ה-trap הופך יתרון לשוויון.',
      highlight: { source: ['No other planet', 'as large as'], correct: ['the largest'], trap: ['about the same size as'] },
    },
  },
  {
    id: 'negation-scope',
    title: 'היקף השלילה',
    rule: 'not all ≠ none — על מה בדיוק חלה השלילה?',
    why: '"Not all X are Y" אומר שחלק מ-X אינם Y — וייתכן שחלק כן. "No X are Y" אומר שאף אחד לא. המסיח הופך שלילה חלקית לשלילה מוחלטת (או להפך), וזה נראה כמו אותה טענה במבט מהיר.',
    example: {
      kind: 'pair',
      source: 'Not every student who studied abroad improved their English.',
      correct: 'Some students who studied abroad did not improve their English.',
      trap: 'None of the students who studied abroad improved their English.',
      note: '"Not every" = חלק לא; "None" = אף אחד. שלילה חלקית הפכה למוחלטת.',
      highlight: { source: ['Not every'], correct: ['Some', 'did not'], trap: ['None'] },
    },
  },
];

/** Precision rules for answering — replaces over-general heuristics. */
export const TOO_SIMILAR_RULE: LayeredRule = {
  id: 'too-similar',
  title: 'דמיון למקור',
  rule: 'תשובה שדומה מאוד למקור — סימן לבדוק, לא סיבה לפסול.',
  why: 'מסיחים רבים מעתיקים את רוב הניסוח ומשנים שומר אחד, ולכן דמיון גבוה מצדיק מעבר שיטתי על השומרים. אבל גם התשובה הנכונה יכולה להישאר קרובה למקור — למשל כשרק הקול (פעיל/סביל) השתנה. ההכרעה היא תמיד בדיקת השומרים, אף פעם לא מידת הדמיון.',
  example: {
    kind: 'pair',
    source: 'The manager approved the budget after a long discussion.',
    correct: 'The budget was approved by the manager after a long discussion.',
    trap: 'The manager approved the budget before the discussion began.',
    note: 'הנכונה כמעט זהה למקור (רק סביל). פסילה בגלל דמיון הייתה טעות; ה-trap נופל בשומר הזמן.',
    highlight: { source: ['after'], correct: ['was approved by'], trap: ['before'] },
  },
};

export const CHANGE_ANSWER_RULE: LayeredRule = {
  id: 'change-answer',
  title: 'שינוי תשובה',
  rule: 'שנה תשובה כשמצאת סיבה קונקרטית — לא בגלל תחושה.',
  why: 'העצה "תמיד להישאר עם האינטואיציה הראשונה" לא נתמכת במחקר: במבחני בחירה מרובה נמצא שבערך מחצית משינויי התשובה היו מתשובה שגויה לנכונה, ורק כרבע מנכונה לשגויה. הסיכון האמיתי הוא שינוי מתוך חרדה. לכן הכלל: אם בבדיקה שנייה זיהית מילה, שומר או שורה בקטע שפוסלים את מה שסימנת — שנה. אם זו רק אי-נוחות — השאר.',
  example: {
    kind: 'scenario',
    text: 'בסבב השני אתה רואה שבחרת "will reduce" כשהמקור אמר "may reduce" — זו סיבה קונקרטית (שומר המודאליות): משנים. לעומת זאת, אם תשובה אחרת פשוט "נשמעת עכשיו טוב יותר" ולא מצאת מה פסול בזו שבחרת — נשארים.',
  },
  source: 'Kruger, Wirtz & Miller (2005), "Counterfactual thinking and the first instinct fallacy", Journal of Personality and Social Psychology 88(5).',
};

/** The shared "rescue protocol" step every question type ends with. */
const CHANGE_ANSWER_STEP = { step: 'רוצה לשנות תשובה?', detail: CHANGE_ANSWER_RULE.rule };

/* ─── שיטות עבודה לכל סוג שאלה ─────────────────────────────────────────────── */

export type CtaTone = 'accent' | 'alt' | 'sage';

export interface DeepGuide {
  /** Subtitle under the page title on /tips/[type]. */
  subtitle: string;
  /** One-liner on the /tips index card. */
  cardDesc: string;
  whatItTests?: { title: string; body: string };
  method?: { title: string; intro?: string; steps: { title: string; body: string }[]; numbered: boolean };
  tips?: { title: string; items: { tip: string; example: string }[] };
  /** Interactive rule cards (rule → why → example), rendered with progressive disclosure. */
  layered?: { title: string; intro?: string; rules: LayeredRule[] }[];
  traps?: { title: string; items: { trap: string; detail: string }[] };
  questionKinds?: {
    title: string;
    intro: string;
    items: { type: string; tone: CtaTone; how: string; signal: string }[];
  };
  elimination?: { title: string; intro: string; items: { flag: string; desc: string }[] };
  /** Render the time-budget row for this type (from TIME_BUDGET). */
  showTimeBudget?: boolean;
  ctas: { href: string; icon: LucideIcon; tone: CtaTone; title: string; body: string }[];
}

export interface QuestionGuide {
  id: QuestionTypeId;
  icon: LucideIcon;
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
  deep: DeepGuide;
}

export const QUESTION_GUIDES: QuestionGuide[] = [
  {
    id: 'sentence-completion',
    icon: PenLine,
    color: 'blue',
    titleHe: 'השלמת משפטים',
    titleEn: 'Sentence Completion',
    intro:
      'זה לא רק מבחן אוצר מילים — זה מבחן על היכולת לצפות מה חסר לפני שרואים את האפשרויות. משפט טוב תמיד "מרמז" מה צריך להיכנס בפער, דרך מילת הקישור שבו (ראה נושא "מילות קישור") והטון הכללי שלו. ' +
      'מי שקורא את המשפט וקובע בראש כיוון ברור — חיובי/שלילי, ניגוד/המשך — לפני שהוא בכלל מסתכל על התשובות, לא ניתן לפתות על ידי מסיח שנשמע "יפה" באנגלית אבל לא מתאים להקשר. השיטה למטה בנויה בדיוק סביב העיקרון הזה.',
    approach: [
      { step: 'קרא את המשפט כולו', detail: 'לא רק את הסביבה של הפער. הבן מה המשפט מנסה להגיד.' },
      { step: 'אתר את מילת הקישור', detail: 'although / but / despite = ניגוד; because / therefore = סיבה-תוצאה; also / moreover = תוספת. היא קובעת את כיוון התשובה.' },
      { step: 'השלם בראש — לפני שקוראים תשובות', detail: 'נחש מילה משלך (או לפחות: "צריך כאן משהו חיובי / פעולה של תיקון / תיאור של כמות"). כך המסיחים לא ישתלו לך רעיון.' },
      { step: 'עבור על 4 התשובות ופסול', detail: 'פסול מה שלא מסתדר במשמעות, בטון (חיובי/שלילי), או במבנה שאחרי הפער (למשל מילת יחס שהמילה לא "מתחברת" אליה).' },
      { step: 'הצב את הבחירה במשפט וקרא אותו שוב', detail: 'אם המשפט זורם והגיוני מההתחלה עד הסוף — סמן והתקדם.' },
    ],
    stuck: [
      { step: 'לא מכיר את המילים בתשובות?', detail: 'פרק אותן לשורש ותחילית: un-/dis-/mis- = שלילה, re- = שוב, bene- = טוב, mal- = רע. לרוב זה מספיק כדי לדעת אם המילה "חיובית" או "שלילית" — ולפסול לפי הטון.' },
      { step: 'לא מבין את המשפט עצמו?', detail: 'זהה רק את הטון: האם הסוף "טוב" או "רע"? מילת הקישור + טון = בחירה מושכלת גם בלי להבין הכל.' },
      { step: 'נשארו שתי תשובות שקולות?', detail: 'בדוק איזו מהן "מתחברת" למבנה שאחרי הפער (protect ‎from, rely ‎on, advise ‎to). עדיין תיקו? בחר ועבור הלאה — 50% זה מצוין.' },
      CHANGE_ANSWER_STEP,
      { step: 'עברו 90 שניות?', detail: 'עצור. נחש מבין מה שנשאר, סמן, והתקדם. שאלה אחת לא שווה את שלוש האחרות.' },
    ],
    tipsHref: '/tips/sentence-completion',
    workedExample: {
      prompt: 'Although the manager praised the report, she asked the team to ___ several sections before the final submission.',
      options: ['ignore', 'revise', 'publish', 'discard'],
      correctIndex: 1,
      walkthrough: [
        'מילת קישור: "Although" = ניגוד. יש שבח ("praised") — אז מה שבא אחרי חייב להיות הפוך/מנוגד לשבח מוחלט, לא המשך חיובי סתמי.',
        'השלמה עצמאית בראש: "היא ביקשה מהצוות לעשות משהו לכמה סעיפים לפני ההגשה" — סביר שמדובר בתיקון/שיפור, לא בפעולה קיצונית.',
        'פסילה: "ignore" (להתעלם) סותר לוגית — למה לבקש להתעלם מסעיפים לפני הגשה סופית? "publish" (לפרסם) לא מתאים — זו כבר "הגשה סופית", לא פרסום. "discard" (לזרוק) קיצוני מדי מול "praised" (היא ציינה שבח, לא פסילה מוחלטת).',
        '"revise" (לתקן/לערוך) — היחיד שמתיישב עם הניגוד העדין של "although": שבח כללי, אבל עדיין יש מה לשפר לפני הסוף. זו התשובה.',
      ],
    },
    deep: {
      subtitle: 'שאלות ברמה 100–150 | Sentence Completion',
      cardDesc: 'שיטה ב-5 שלבים לבחירת המילה הנכונה בהקשר',
      whatItTests: {
        title: 'מה הסעיף בודק — משמעות בהקשר, לא "מה שנשמע נכון"',
        body:
          'בדרך כלל ארבע האפשרויות הן מאותו סוג מילה (ארבעה פעלים, ארבעה תארים וכו\'), ולכן **דקדוק לבדו כמעט אף פעם לא מכריע** — ההכרעה היא **במשמעות**: איזו מילה מתאימה להקשר הלוגי של המשפט כולו. ' +
          'זו הסיבה שאי אפשר לפתור לפי "מה שנשמע נכון" — מסיח טוב נשמע טבעי באוזן, קשור לנושא המשפט, ועדיין סותר את ההיגיון שלו. השיטה למטה בנויה כך שתגבש ציפייה משלך לפני שהמסיחים מספיקים להשפיע עליך.',
      },
      method: {
        title: 'שיטה ב-5 שלבים',
        numbered: true,
        steps: [
          {
            title: 'קרא את המשפט המלא',
            body: 'קריאה חלקית (רק סביב הפער) היא המקור הכי נפוץ לטעויות — כי היא מפספסת בדיוק את מילת הקישור או הפרט שקובע את הכיוון. תמיד קוראים את המשפט כולו קודם, ורק אז חוזרים לפער.',
          },
          {
            title: 'השלם בראש — לפני שאתה קורא את התשובות',
            body: 'ברגע שאתה קורא את ארבע האופציות לפני שגיבשת ציפייה משלך, המוח מתחיל "להיצמד" למילה שנשמעת הכי מוכרת — גם אם היא שגויה. ניחוש עצמאי (ולו כללי: "צריך כאן משהו שלילי") הוא חיסון נגד המלכודת הזו, כי הוא נותן לך קנה מידה בלתי-תלוי להשוות אליו כל אופציה.',
          },
          {
            title: 'הגדר מה הפער צריך לעשות',
            body: 'לא "איזה סוג מילה" — זה כמעט תמיד כבר נתון, כי כל האופציות מאותו סוג — אלא "איזה תפקיד": פעולה של תיקון? תיאור של כמות? תוצאה שלילית? ככל שההגדרה שלך חדה יותר, כך קל יותר לפסול אופציה שנשמעת טוב אבל עושה משהו אחר.',
          },
          {
            title: 'סלק לפי משמעות',
            body: 'הצב כל אופציה בתוך המשפט, לא לבד. מילה יכולה להיות תקינה כשלעצמה ועדיין לא להתאים להקשר הספציפי הזה — הבדיקה תמיד בהקשר המלא, לא במנותק ממנו. שים לב גם למבנה שאחרי הפער: יש מילים ש"מתחברות" רק למילת יחס מסוימת.',
          },
          {
            title: 'בדוק התאמת טון',
            body: 'זהו הסינון האחרון והכי אמין כשנשארות שתי אופציות קרובות: המשפט כולו חיובי, שלילי או ניטרלי? מילת הקישור (ראה מדריך מילות הקישור) כבר סימנה לך את הטון הצפוי — אם התשובה סותרת אותו, היא שגויה גם אם היא "נשמעת" סבירה.',
          },
        ],
      },
      tips: {
        title: '6 טיפים עם דוגמאות',
        items: [
          {
            tip: 'חפש מילות מפתח לפני הפער ואחריו',
            example:
              '"Despite the heavy rain, the outdoor concert was _____." — "despite" הוא מילת ניגוד (ראה מדריך מילות הקישור): גשם כבד צפוי לפגוע בקונצרט בחוץ, ולכן הפער חייב לסתור את הציפייה הזו — "well-attended" או "a great success", לא "postponed" או "half-empty". שימו לב: הניגוד חייב לעבור דרך הפער עצמו — אם המילה שאחרי הפער כבר מספקת אותו (למשל "a ___ success"), despite לבדו לא מכריע.',
          },
          {
            tip: 'בדוק את המבנה שאחרי הפער — לא רק את המשמעות',
            example:
              '"The new law is designed to _____ small businesses from unfair competition." — ארבעת הפעלים (protect / support / promote / encourage) כולם מתאימים ל"עזרה לעסקים קטנים", אבל רק "protect" מתחבר ל-"from": מגנים על X מפני Y. המבנה שאחרי הפער הוא לפעמים מה שמכריע בין שתי אופציות קרובות במשמעות.',
          },
          {
            tip: 'שים לב למילות חיבור בין-משפטיות',
            example:
              '"He was tired; _____, he continued working." — אחרי נקודה-פסיק חסרה מילת קישור בין-משפטית שמסמנת ניגוד: however / nevertheless. שימו לב שהמבנה הדקדוקי כאן (נקודה-פסיק + פסיק) הוא בדיוק מה שהמדריך מסביר לגבי however.',
          },
          {
            tip: 'אוצר מילים: למד שורשים לטיניים ויווניים',
            example:
              'שורש "bene-" = טוב: beneficial, benevolent, benign. ברגע שמזהים שורש משותף, אפשר לנחש משמעות של מילה לא-מוכרת מתוך משפחה מוכרת — זה עובד גם באמצע מבחן, בלי מילון.',
          },
          {
            tip: 'אם אין לך מושג — בחר לפי יחסי ניגוד במשפט',
            example:
              '"The speech was not _____ but rather confusing." — "not X but rather Y" הוא מבנה ניגוד מפורש: X ו-Y חייבים להיות הפכים. אם "confusing" הוא Y, אז X חייב להיות ההפך שלו — "clear" או "coherent".',
          },
          {
            tip: 'זהה תחיליות — גם כשאינך מכיר את המילה',
            example:
              'un-/dis-/mis- = שלילה או טעות, re- = שוב, over- = יותר מדי, under- = פחות מדי. מילה זרה לגמרי עדיין "מסגירה" כך את כיוון המשמעות שלה — חיובי או שלילי, יותר או פחות — ולעיתים זה מספיק כדי לפסול אופציות לפי הטון, בלי לדעת את התרגום המדויק.',
          },
        ],
      },
      traps: {
        title: 'מלכודות נפוצות — ולמה הן עובדות',
        items: [
          {
            trap: 'מילה שקשורה לנושא — אבל לא למשפט',
            detail: '"The doctor _____ the patient to rest for a week." — "cured" או "treated" שייכות לעולם הרפואה ולכן מושכות את העין, אבל רק "advised" מתאימה למה שהמשפט באמת אומר (ולמבנה "to rest"). המלכודת עובדת כי המוח מחפש מילה "מאותו תחום" במקום מילה שעושה את התפקיד הנכון.',
          },
          {
            trap: 'מסיחים עם משמעות דומה',
            detail: 'המבחן כולל בכוונה 2-3 מילים שנראות/נשמעות דומות אך שונות במשמעות: "affect" (להשפיע) לעומת "effect" (השפעה), "principle" (עיקרון) לעומת "principal" (ראשי/מנהל), "adapt" (להתאים) לעומת "adopt" (לאמץ). ההבדל נקבע לפי המשמעות בהקשר, לא לפי הצליל.',
          },
          {
            trap: 'מילה שמשלימה את הפער אך הופכת את המשמעות',
            detail: '"The policy was intended to _____ the problem." — גם "create" וגם "solve" מסתדרים דקדוקית (שני פעלים), אבל רק אחד הגיוני מבחינת מטרת "policy". כאן חובה לחזור להקשר הכולל של המשפט, לא רק לתאימות הדקדוקית המקומית.',
          },
        ],
      },
      ctas: [
        {
          href: '/strategies',
          icon: Compass,
          tone: 'accent',
          title: 'מדריך מילות הקישור המלא',
          body: 'הצעד השני בשיטה כאן ("השלם בראש") נשען בעיקר על זיהוי מילת הקישור. במדריך האסטרטגיות המלא יש הסבר מלא לכל מילה — כולל המלכודות הדקדוקיות שלה.',
        },
        {
          href: '/vocabulary?pack=connectors',
          icon: Link2,
          tone: 'alt',
          title: 'חבילת 200+ מילות קישור',
          body: 'מילות הקישור הן המפתח לזיהוי הקשר הלוגי במשפט — ניגוד, סיבה, תוספת. תרגל אותן בכרטיסיות באוצר המילים (קטגוריית "מחברים").',
        },
      ],
    },
  },
  {
    id: 'restatement',
    icon: RotateCcw,
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
      { step: 'עבור על שמונת השומרים', detail: `${RESTATEMENT_GUARDS.map(g => g.title).join(' · ')}. שומר אחד שהשתנה = תשובה שגויה.` },
      { step: TOO_SIMILAR_RULE.title, detail: TOO_SIMILAR_RULE.rule },
    ],
    stuck: [
      { step: 'לא מבין את משפט המקור?', detail: 'אל תנסה לתרגם מילה-מילה. זהה רק את השלד: מילת קישור + מי + פועל. גם הבנה חלקית מספיקה לפסול שני מסיחים.' },
      { step: 'שתי תשובות נראות נכונות?', detail: 'אחת מהן כמעט תמיד סוטה באחד "השומרים" — השווה אותן זו לזו (לא רק למקור) ומצא במה הן נבדלות. ההבדל הזה הוא המבחן.' },
      { step: 'מבנה מוזר (No sooner... / Had the...)?', detail: 'אלו היפוכים ספרותיים. תרגם לסדר רגיל: "No sooner had X than Y" = מיד אחרי X קרה Y; "Had X been" = If X had been.' },
      CHANGE_ANSWER_STEP,
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
    deep: {
      subtitle: 'Restatement | מציאת משמעות זהה במבנה שונה',
      cardDesc: 'כיצד למצוא את המשפט בעל המשמעות הזהה במהירות',
      whatItTests: {
        title: 'מה הסעיף בודק — ולמה זו לא בדיקת אוצר מילים',
        body:
          'מוצג לך משפט מקור, ועליך לבחור מבין 4 אפשרויות את זו שמבטאת **אותה משמעות בדיוק** — במבנה לשוני שונה לחלוטין. מסיחים רבים מעתיקים את רוב הניסוח ומחליפים בשקט פרט אחד קריטי (כמות, כיוון, ודאות) — ולכן דמיון למקור הוא סימן לבדוק, לא סימן לתשובה נכונה או שגויה. ' +
          'המבחן בודק אם הבנת את **הלוגיקה** של המשפט, לא אם זיהית מילים מוכרות בתוכו.',
      },
      method: {
        title: 'השיטה הבסיסית',
        numbered: false,
        steps: [
          {
            title: 'מצא את גרעין המשפט: מי עשה מה, למי, ומה הקשר הלוגי',
            body: 'פרק את משפט המקור לשלושה רכיבים: **מי** (הנושא), **מה קרה** (הפעולה והתוצאה), ו-**איזה קשר לוגי** מחבר ביניהם — ניגוד (although, despite), סיבה-תוצאה (because, therefore) או תנאי (if, unless — ראה מדריך מילות הקישור). זה "תעודת הזהות" של המשפט: כל תשובה שמשנה אפילו רכיב אחד מהשלושה — משנה משפט לגמרי אחר, גם אם היא נשמעת דומה.',
          },
          {
            title: 'התמקד במשמעות — לא במילים',
            body: 'נסח לעצמך בעברית מה המשפט אומר, לפני שאתה קורא אפשרות אחת. הסיבה: ברגע שאתה משווה מילה-למילה נגד האנגלית המקורית, קל "להיתפס" על תשובה שחולקת אוצר מילים אבל לא לוגיקה. השוואה נגד תרגום עברי משלך מנטרלת את המלכודת הזו — כי אתה בודק רעיון מול רעיון, לא מילה מול מילה.',
          },
          {
            title: 'בדוק: האם כל חלקי המשמעות נשמרו?',
            body: 'משפטי מקור מכילים לרוב יותר ממידע אחד (למשל: מי + מתי + למה). תשובה נכונה שומרת על **כולם** — תשובה שמדייקת בחלק אחד ומחסירה או משנה חלק אחר עדיין נחשבת שגויה. זו הסיבה ש"קרוב" לא מספיק כאן.',
          },
        ],
      },
      layered: [
        {
          title: 'שמונת השומרים — מה המסיח משנה בשקט',
          intro: 'כל מסיח טוב משאיר את הנושא ואת רוב הניסוח, ומשנה בשקט אחד מהשומרים האלה. הקש על כלל כדי לראות למה הוא עובד, ושוב כדי לראות דוגמה.',
          rules: RESTATEMENT_GUARDS,
        },
        {
          title: 'כללי דיוק',
          rules: [TOO_SIMILAR_RULE, CHANGE_ANSWER_RULE],
        },
      ],
      traps: {
        title: 'מלכודות נפוצות — ולמה הן עובדות',
        items: [
          {
            trap: 'אותן מילים — משמעות שונה',
            detail: 'תשובה מכילה כ-70% מהמילים מהמקור, אבל הופכת את כיוון הסיבה-תוצאה. המבחן עושה זאת בכוונה כדי לבדוק אם אתה בודק לוגיקה או רק "זיהוי מילים מוכרות".',
          },
          {
            trap: 'משמעות הפוכה (opposite)',
            detail: 'כמעט תמיד יש אופציה שאומרת את ההפך המדויק מהמקור. אם נפלת עליה, זה סימן ברור שהבנת נכון את הנושא של המשפט אבל טעית בכיוון היחס הלוגי בתוכו — שווה לחזור ולבדוק מילת קישור.',
          },
          {
            trap: 'משמעות חלקית (partial meaning)',
            detail: 'התשובה נכונה לגבי חלק מהמשפט, אבל מחסירה מידע חשוב מהחלק השני. תמיד משווים נגד כל שלושת הרכיבים של הגרעין (מי, מה, קשר לוגי) — לא רק נגד הרכיב הראשון שקפץ לעין.',
          },
        ],
      },
      ctas: [
        {
          href: '/strategies',
          icon: Compass,
          tone: 'accent',
          title: 'מדריך מילות הקישור המלא',
          body: 'זיהוי הקשר הלוגי (הרכיב השלישי בגרעין) נשען כולו על מילות קישור. במדריך האסטרטגיות המלא יש הסבר מלא לכל אחת — כולל מלכודות דקדוקיות.',
        },
      ],
    },
  },
  {
    id: 'reading-comprehension',
    icon: BookOpen,
    color: 'green',
    titleHe: 'הבנת הנקרא',
    titleEn: 'Reading Comprehension',
    intro:
      'זה הפרק שבו שתי המיומנויות הקודמות (זיהוי קשרים לוגיים דרך מילות קישור, והשוואה מדוקדקת של ניסוחים) מתאחדות ברמת פסקה שלמה, לא רק משפט בודד. ' +
      'ההבדל המכריע בין נבחן שמבזבז זמן לנבחן יעיל הוא סדר הפעולות: הצצה קצרה בשאלות לפני הקריאה נותנת "מפת חיפוש" בראש — כך שבמקום לקרוא את כל הקטע כדי לענות על כל שאלה, קוראים פעם אחת ויודעים מראש לאן לחזור.',
    approach: [
      { step: 'הצץ בשאלות — 30 שניות', detail: 'לא לקרוא לעומק: רק לזהות מילות מפתח ("לפי הקטע, מדוע...") כדי לדעת מה לחפש. אל תקרא עדיין את התשובות.' },
      { step: 'קרא את הקטע ברצף — כ-4 דקות', detail: 'קריאה אחת מלאה ומהירה. אל תעצור על מילה לא מוכרת — סמן אותה בראש והמשך. המטרה: רעיון מרכזי + מה יש בכל פסקה.' },
      { step: 'ענה קודם על שאלות הפרט', detail: 'שאלות "לפי הקטע..." קלות יותר ומחזירות אותך לטקסט. אתר את הפסקה הרלוונטית לפי מילת מפתח וקרא שם 2-3 שורות.' },
      { step: 'שמור את "הרעיון המרכזי" וההסקה לסוף', detail: 'אחרי שענית על הפרטים אתה כבר מכיר את הקטע לעומק — שאלות הכלל נהיות קלות בהרבה.' },
      { step: 'פסול תשובות קיצוניות', detail: 'only / always / never / all — כמעט תמיד שגויות, אלא אם הקטע אמר זאת במפורש. התשובה הנכונה בדרך כלל "מאוזנת".' },
    ],
    stuck: [
      { step: 'לא מוצא את התשובה בקטע?', detail: 'קח מילת מפתח מהשאלה (שם, מספר, מונח) וסרוק את הקטע רק כדי לאתר אותה — אל תקרא הכל מחדש. התשובה תמיד בסביבת מילת המפתח.' },
      { step: 'שאלת הסקה ("ניתן להבין ש...") תקועה?', detail: 'פסול כל תשובה שמשתמשת בידע חיצוני או מגזימה. הנכונה היא תמיד צעד אחד קטן מהטקסט — לא קפיצה.' },
      { step: 'מילה קריטית לא מוכרת בשאלת אוצר מילים?', detail: 'קרא את המשפט שסביבה ושאל מה הגיוני שיהיה שם. אלו שאלות הקשר, לא מילון — הפירוש המילולי הוא לרוב המלכודת.' },
      CHANGE_ANSWER_STEP,
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
    deep: {
      subtitle: 'Reading Comprehension | קריאה אסטרטגית ויעילה',
      cardDesc: 'אסטרטגיית קריאה חכמה וניהול זמן לפסקאות',
      method: {
        title: 'סדר הקריאה המומלץ — ולמה דווקא הוא',
        intro:
          'שתי גישות קיצוניות נפוצות בשוק ההכנה: לקרוא את כל השאלות לפני הקטע (מסוכן — הופך את הקריאה ל"חיפוש" ומפספס את הרעיון המרכזי), או לקרוא את הקטע במלואו בלי שום כיוון (מסוכן אחרת — קוראים "בחושך" וחוזרים לטקסט שוב ושוב). ' +
          'הגישה שעובדת הכי טוב היא **משולבת**: הצצה קצרה שנותנת כיוון, ואז קריאה אחת מלאה שמכסה גם את הפרטים וגם את התמונה השלמה.',
        numbered: true,
        steps: [
          {
            title: 'הצצה בשאלות — כ-30 שניות, לא יותר',
            body: 'לא לקרוא לעומק ובטח לא לקרוא את התשובות — רק לזהות מילות מפתח בשאלות עצמן ("לפי הקטע, מדוע…", "the word X most likely means"). זה נותן לך "מפת חיפוש" בראש בלי לפגוע ביכולת לתפוס את הרעיון הכללי בקריאה הבאה.',
          },
          {
            title: 'קרא את הקטע ברצף אחד, מההתחלה עד הסוף',
            body: 'קריאה מהירה ורצופה, בלי לעצור על מילה לא מוכרת (סמן אותה בראש והמשך). המטרה כאן היא לצאת עם שני דברים: מה הרעיון המרכזי, ומה יש בכל פסקה בקווים כלליים — לא לזכור כל משפט.',
          },
          {
            title: 'ענה קודם על שאלות הפרט',
            body: 'שאלות "לפי הקטע…" קלות יותר לפתור כי הן מחזירות אותך לפסקה ספציפית לפי מילת מפתח שכבר ראית בשלב 1. הן גם "מכריחות" אותך לחזור לטקסט ולרענן פרטים שיעזרו אחר כך.',
          },
          {
            title: 'שמור את הרעיון המרכזי וההסקה לסוף',
            body: 'אחרי שענית על שאלות הפרט, אתה כבר מכיר את הקטע לעומק בלי מאמץ נוסף — שאלות הכלל (main idea, הסקה) נהיות משמעותית קלות יותר בשלב הזה מאשר אם היית מנסה לענות עליהן ראשונות.',
          },
        ],
      },
      questionKinds: {
        title: '3 סוגי שאלות — ולמה כל אחת דורשת גישה שונה',
        intro:
          'לא כל שאלה בפרק נבדקת אותו דבר. זיהוי הסוג לפני שמנסים לענות חוסך זמן — כי הוא קובע איפה בכלל לחפש את התשובה: בתוך הטקסט המילולי, בין השורות, או במילה בודדת.',
        items: [
          {
            type: 'רעיון מרכזי (Main Idea)',
            tone: 'sage',
            how: 'התשובה הנכונה חייבת להיות רחבה מספיק לכסות את כל הקטע, לא רק פסקה אחת ממנו. תשובה שמדייקת בפרט אחד אבל לא מתארת את הקטע כולו — פסולה, גם אם היא נכונה עובדתית.',
            signal: 'מילות מפתח בשאלה: "mainly about", "primary purpose", "best title"',
          },
          {
            type: 'פרט ספציפי (Specific Detail)',
            tone: 'accent',
            how: 'אל תסתמך על הזיכרון מהקריאה הראשונה — חזור לקטע ואתר את המידע במפורש. כמעט תמיד המידע כתוב מילולית בטקסט, לא דורש הסקה.',
            signal: 'מילות מפתח: "according to the passage", "the author states", "which of the following"',
          },
          {
            type: 'מילה בהקשר (Vocabulary in Context)',
            tone: 'alt',
            how: 'ההגדרה ה"מילונית" שאתה מכיר לא בהכרח נכונה כאן — קרא את המשפט הספציפי ובדוק איזו משמעות מתאימה להקשר הזה. זו שאלת הקשר, לא שאלת תרגום.',
            signal: 'מילות מפתח: "the word X most likely means", "as used in paragraph Y"',
          },
        ],
      },
      elimination: {
        title: 'שיטת האלימינציה',
        intro: 'כשלא בטוחים, פוסלים ולא מנחשים באקראי. ארבעה סוגי תשובות חוזרים כמלכודות — לזהות אותן זה כבר חצי מהעבודה:',
        items: [
          { flag: 'קיצוני מדי', desc: '"always" / "never" / "all" / "completely" — קטעים אקדמיים כמעט אף פעם לא טוענים טענות כה מוחלטות. התשובה הנכונה בדרך כלל מאוזנת ("often", "may", "some").' },
          { flag: 'לא הוזכר', desc: 'נשמעת הגיונית ואפילו נכונה בעולם האמיתי — אבל פשוט לא כתובה בקטע. הידע הכללי שלך לא רלוונטי; רק מה שכתוב.' },
          { flag: 'הפוך', desc: 'ההפך המדויק ממה שהקטע אומר. מלכודת קלאסית לקורא ששרד את הקטע אבל התבלבל בכיוון של משפט ניגוד.' },
          { flag: 'מסיט', desc: 'קשור לנושא, מוזכר בקטע, אבל לא עונה בדיוק על מה שהשאלה שאלה. תמיד לחזור ולבדוק: זו התשובה לשאלה הזו, או לשאלה דומה?' },
        ],
      },
      showTimeBudget: true,
      ctas: [
        {
          href: '/strategies',
          icon: Compass,
          tone: 'sage',
          title: 'שיטות הקריאה בשוק — ולמה משולבת עדיפה',
          body: 'במדריך האסטרטגיות המלא יש השוואה מפורטת בין שלוש הגישות המקובלות בשוק ההכנה, כולל היתרונות והחסרונות של כל אחת.',
        },
      ],
    },
  },
];

export const GUIDE_BY_ID: Record<QuestionTypeId, QuestionGuide> =
  Object.fromEntries(QUESTION_GUIDES.map(g => [g.id, g])) as Record<QuestionTypeId, QuestionGuide>;

/* ─── מילות הקישור — מודול לימודי מלא ─────────────────────────────────────── */

export interface ConnectorWord {
  word: string;
  meaning: string;
  grammar: string;
  example: string;
  exampleExplain: string;
}

export interface ConnectorCategory {
  id: string;
  title: string;
  icon: LucideIcon;
  color: 'red' | 'blue' | 'green' | 'amber';
  intro: string;
  words: ConnectorWord[];
}

export const CONNECTORS_INTRO =
  'שאלת אמירנ"ט לא באמת בודקת אם אתה מכיר את המילה "despite". היא בודקת משהו הרבה יותר בסיסי: האם אתה מזהה את הקשר הלוגי בין שני חלקי המשפט. ' +
  'תחשוב על זה כך — לפני שאתה קורא מילה אחת מהתשובות, המשפט כבר "אמר" לך אם הוא הולך להפתיע אותך (ניגוד), להסביר את עצמו (סיבה-תוצאה), ' +
  'להוסיף על מה שכבר נאמר (תוספת), או להציב דרישה (תנאי). מילת הקישור היא התמרור הזה. מי שלומד לקרוא אותה נכון, פותר חצי מהשאלה עוד לפני שהגיע לפער או לתשובות.';

export const CONNECTORS_OUTRO =
  'שימו לב: זו בדיוק אותה מיומנות שחוזרת בשלושת סוגי השאלות, רק בלבוש שונה. בהשלמת משפטים מילת הקישור אומרת לך איזה טון צריך במילה החסרה. ' +
  'בניסוח מחדש היא חלק מ"הגרעין" שאתה מחלץ ממשפט המקור — ואם התשובה משנה בשקט "despite" ל-"because", זו כבר לא אותה טענה. ' +
  'ובהבנת הנקרא היא זו שמסמנת לך איפה הקטע עומד לפנות — קדימה לאותו כיוון, או אחורה נגדו. ברגע שהיא הופכת אוטומטית, שלושת הסוגים נהיים קלים יותר בבת אחת.';

export const CONNECTOR_CATEGORIES: ConnectorCategory[] = [
  {
    id: 'contrast',
    title: 'ניגוד',
    icon: Zap,
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
          'זה שונה מהותית מ-despite, וכדאי להכיר את ההבדל כדי לזהות מהר את מבנה המשפט.',
        example: 'Although the exam was long, most students finished on time.',
        exampleExplain:
          'המשפט פותח ב"although" — סימן שמה שיבוא אחריו (התלמידים סיימו בזמן) הולך לסתור את מה שהיינו מצפים ממנו (מבחן ארוך = כנראה לא מספיקים). זו בדיוק תבנית "ציפייה מול תוצאה" האופיינית לניגוד.',
      },
      {
        word: 'despite / in spite of',
        meaning: 'למרות...',
        grammar:
          'בניגוד ל-although, אלו מילות יחס (prepositions) — ולכן אחריהן חייב לבוא שם עצם או gerund (V-ing), לא משפט שלם. "Despite the rain" נכון; "Despite it rained" שגוי. ' +
          'אם צריך לתאר משפט שלם אחרי despite, פותרים את זה עם "the fact that": "Despite the fact that it rained." שווה לזכור את ההבחנה הזו בנפרד מ-although, גם אם המשמעות דומה.',
        example: 'Despite the heavy rain, the match continued as planned.',
        exampleExplain:
          '"the heavy rain" הוא שם עצם, לא משפט — בדיוק כמו שהכלל מחייב. שימו לב שהמשמעות זהה ל-"Although it rained heavily" — רק המבנה הדקדוקי משתנה.',
      },
      {
        word: 'however',
        meaning: 'אולם / עם זאת',
        grammar:
          'זו מילת קישור בין-משפטית (conjunctive adverb), לא כפיפה — ולכן אינה מחברת ישירות שני חלקי משפט באותו משפט. היא באה אחרי נקודה, או אחרי נקודה-פסיק (;), ולרוב עם פסיק אחריה: "The plan was solid; however, it failed." ' +
          'במבחן זה עוזר לקרוא נכון: כשרואים "; however," יודעים שמתחיל משפט עצמאי חדש שהולך נגד הרושם של הקודם — גם בתוך קטע קריאה ארוך.',
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
    icon: RotateCcw,
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
    icon: Plus,
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
    icon: KeyRound,
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

/* ─── איפה כן שווה להשקיע ─────────────────────────────────────────────────── */

export const INVEST_INTRO =
  'תקציב הזמן (בנושא "תקציב זמן") קובע גבולות אחידים — אבל בפועל, לא כל דקה ולא כל פרק שווים אותו דבר מבחינת תשומת הלב. ' +
  'יש שלושה מקומות ספציפיים במבנה המבחן שבהם כדאי לחלק את הריכוז והזמן אחרת ממה שהאינסטינקט אומר. להכיר את שלושתם משנה איך מחלקים תשומת לב לאורך כל המבחן, לא רק בתוך פרק בודד.';

export const INVEST_POINTS: { icon: LucideIcon; title: string; body: string }[] = [
  {
    icon: Route,
    title: 'הפרק הראשון קובע את נקודת הפתיחה — לא את הגורל',
    body:
      'הפרק הראשון נותן למנוע האדפטיבי את ההערכה הראשונית שלך, ולפיה נבחר הקושי של הפרק הבא. אבל המנוע ממשיך לעדכן את ההערכה אחרי כל תשובה ואחרי כל פרק, כך שפתיחה חלשה בהחלט ניתנת לתיקון בהמשך — פרקים טובים אחריה מעלים את הרמה בחזרה. ' +
      'עם זאת, פתיחה חזקה חוסכת לך את הטיפוס הזה: היא מכניסה אותך מוקדם לפרקים הקשים, שבהם נמדדים הציונים הגבוהים. ' +
      'המסקנה המעשית: גש לפרק הראשון בריכוז מלא ואל תזלזל בשאלות "קלות" — אבל אם הוא הלך פחות טוב, אל תיכנס ללחץ. כל פרק הבא הוא הזדמנות אמיתית לתקן.',
  },
  {
    icon: BookOpen,
    title: 'הבנת הנקרא — המקום היחיד שבו אפשר לאגם זמן',
    body:
      'לא בגלל שיש שם יותר זמן לשאלה — אחרי הקריאה נשארות כ-2 דקות לשאלה, בדיוק כמו בניסוח מחדש (ראה נושא "תקציב זמן"). היתרון הוא אחר: חמש השאלות נשענות על אותו קטע, ושאלות פרט נפתרות לרוב מהר יותר מהממוצע כי הטקסט כבר מוכר לך. ' +
      'הזמן שנחסך בהן מצטבר בתוך הפרק, ורק כאן אפשר להשקיע אותו בשאלה אחת קשה — עד 3 דקות. בהשלמת משפטים, לעומת זאת, כל שאלה עומדת בפני עצמה, ואותן 3 דקות היו עולות לך שלוש שאלות אחרות. ' +
      'אבל התנאי קריטי: זה תקף רק אחרי שכל שאר השאלות בפרק כבר קיבלו תשובה. תקיעה מוקדמת על שאלה אחת עדיין מסכנת את היתר.',
  },
  {
    icon: FlaskConical,
    title: 'הפרקים הניסיוניים — להתייחס אליהם כמו לפרקים אמיתיים',
    body:
      'בבחינת אמירנ"ט עשויים להופיע בסוף פרקים ניסיוניים מסוגים חדשים, או מטלת כתיבה. פרקים אלה אינם יכולים לפגוע בציון שלך. ' +
      'עם זאת, מומלץ להתייחס ברצינות מלאה לכל פרק שמופיע בבחינה, כאילו הוא נספר — גם כי לא תמיד ברור מראש איזה פרק הוא ניסיוני, וגם כי ירידה בריכוז לקראת הסוף היא הרגל שכדאי לא לבנות. ' +
      'האתר עדיין אינו מדמה את סוגי השמע, יצירת המילים, הדקדוק בהקשר או הכתיבה; הפרק האחרון בסימולציה הוא תרגול חלופי בלבד.',
  },
];

/* ─── שיטות מהשוק ─────────────────────────────────────────────────────────── */

export const METHODS_INTRO =
  'הצעד הראשון בשיטת העבודה להבנת הנקרא (בנושא "הבנת הנקרא") הוא "הצץ בשאלות" לפני קריאת הקטע — אבל כדאי להבין שזו בחירה מתוך כמה גישות מתחרות שקורסי ההכנה חלוקים לגביהן, ולא "האמת היחידה". ' +
  'הבנת הטרייד-אוף בין הגישות עוזרת להתאים את הטקטיקה לקצב הקריאה האישי שלך, במקום לאמץ שיטה בעיוורון.';

export const MARKET_METHODS: { title: string; who: string; fit: string; tradeoff: string; recommended?: boolean }[] = [
  {
    title: 'קריאת שאלות לפני הקטע',
    who: 'נפוצה בחלק מקורסי ההכנה המסורתיים',
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
    who: 'ההמלצה שלנו',
    fit: '30 שניות על השאלות לזיהוי מילות מפתח, ואז קריאה מלאה אחת מהירה',
    tradeoff: 'משלב כיוון + תמונה שלמה. זו השיטה שמובנית בשיטת העבודה של הבנת הנקרא.',
    recommended: true,
  },
];

/* ─── הרגלי הכנה ──────────────────────────────────────────────────────────── */

export const HABITS_INTRO =
  'כל השיטות שראית עד כה (מילות קישור, שיטות עבודה לפי סוג, תזמון) הן מיומנויות — ומיומנות לא נקבעת בפעם אחת, היא נבנית בחזרות. ארבעת ההרגלים הבאים לא מחליפים את הידע האסטרטגי, אלא הופכים אותו לאוטומטי, כך שביום המבחן אתה לא צריך "לחשוב" על השיטה — אתה פשוט מיישם אותה.';

export const HABITS: { icon: LucideIcon; text: string; href?: string; cta?: string }[] = [
  { icon: BookOpen, text: '20 דקות קריאה באנגלית כל יום — טקסט לא קל מדי ולא קשה מדי. זו אחת ההמלצות הנפוצות ביותר בהכנה, כי היא בונה זיהוי דפוסי משפט (כולל מילות קישור) באופן טבעי, בלי לשנן בכוח.' },
  { icon: Link2, text: 'שינון מילות קישור — הן מופיעות בכל שלושת סוגי השאלות, ולכן הן ה"מכפיל כוח" היחיד שמשפר בבת אחת גם השלמת משפטים, גם ניסוח מחדש, וגם הבנת הנקרא. תרגל את חבילת 208 המחברים באוצר המילים.', href: '/vocabulary?pack=connectors', cta: 'לתרגול המחברים ←' },
  { icon: Timer, text: 'סימולציית פרקי הליבה עם טיימר — תרגול תחת מגבלות הזמן ונעילת הפרקים של ששת פרקי הליבה. סוגי הפרקים הניסיוניים והכתיבה עדיין אינם מדומים באתר.', href: '/exam', cta: 'לסימולציית הליבה ←' },
  { icon: RotateCcw, text: 'חזרה על טעויות — כל שאלה שטעית בה נכנסת אצלנו לתור החזרה החכמה, ומופיעה שוב במרווחים הולכים וגדלים. חזרה ממוקדת כזו לרוב יעילה יותר משאלות חדשות, כי היא תוקפת פער ספציפי שכבר זוהה.', href: '/review-queue', cta: 'לתור החזרה ←' },
];

/* ─── ניווט בקוביות ───────────────────────────────────────────────────────── */

export type TopicId =
  | 'rules' | 'time' | QuestionTypeId
  | 'connectors' | 'invest' | 'methods' | 'habits';

export const TOPICS: { id: TopicId; icon: LucideIcon; title: string; desc: string }[] = [
  { id: 'rules', icon: Shuffle, title: 'חוקי המשחק', desc: 'איך המבחן עובד — אדפטיביות, טיימר, ניקוד' },
  { id: 'time', icon: Timer, title: 'תקציב זמן', desc: 'כמה זמן לכל שאלה, ומתי לוותר ולנחש' },
  { id: 'sentence-completion', icon: PenLine, title: 'השלמת משפטים', desc: 'שיטת עבודה + דוגמה פתורה' },
  { id: 'restatement', icon: RotateCcw, title: 'ניסוח מחדש', desc: 'שיטת עבודה + דוגמה פתורה' },
  { id: 'reading-comprehension', icon: BookOpen, title: 'הבנת הנקרא', desc: 'שיטת עבודה + דוגמה פתורה' },
  { id: 'connectors', icon: Link2, title: 'מילות קישור', desc: 'המילים שקובעות כמעט כל שאלה' },
  { id: 'invest', icon: Gem, title: 'איפה שווה להשקיע', desc: 'לא כל הדקות שוות באותה מידה' },
  { id: 'methods', icon: BookOpen, title: 'שיטות קריאה', desc: 'איך ניגשים לקטע — והטרייד-אוף' },
  { id: 'habits', icon: CheckCircle2, title: 'הרגלי הכנה', desc: 'מה בונה את המיומנות לאורך זמן' },
];
