'use client';

import { Suspense, useState, useEffect, useRef, useCallback } from 'react';
import { useSearchParams } from 'next/navigation';
import { createClient } from '@/lib/supabase';
import { BackNav } from '@/components/BackNav';
import { authFetch } from '@/lib/auth-fetch';
import { ensureGuestIdentity } from '@/lib/guest';
import { nextInterval, addDays, isDue } from '@/lib/spaced-repetition';
import {
  BookOpen, Heart, Volume2, Trash2, Search, Star, Lightbulb, PartyPopper,
  RotateCcw, Trophy, ThumbsUp, Flame, Settings, Check, X, Target, Clock,
  TrendingDown, Zap, Link2, GraduationCap, Palette, Package, CheckCircle2,
  AlertTriangle, ChevronUp, ChevronDown, Play,
} from 'lucide-react';
import { heCount } from '@/lib/hebrew-count';

/** Small inline star-rating row (filled/outline), used wherever a raw ★/☆ repeat used to render. */
function StarRow({ n, size = 14 }: { n: number; size?: number }) {
  return (
    <span className="inline-flex items-center gap-0.5" aria-label={`רמה ${n} מתוך 5`}>
      {Array.from({ length: 5 }, (_, i) => (
        <Star key={i} width={size} height={size} className={i < n ? 'fill-current text-exam-alt' : 'text-exam-border'} aria-hidden />
      ))}
    </span>
  );
}

interface VocabWord {
  id: string;
  word: string;
  definition: string;
  hebrew_translation: string;
  example_sentence: string;
  category: string;
  difficulty_level: number;
}

type Mode = 'flashcard' | 'quiz' | 'timed';

interface TimedResult {
  word: VocabWord;
  correct: boolean;
  timeTaken: number;
}

const CATEGORY_LABELS: Record<string, string> = {
  general:     'כללי',
  academic:    'אקדמי',
  descriptive: 'תיאורי',
  verbs:       'פעלים',
  connectors:  'מחברים',
  nouns:       'שמות עצם',
  advanced:    'מתקדם',
  adjectives:  'שמות תואר',
};

const CATEGORY_COLORS: Record<string, string> = {
  general:     'bg-exam-paper-alt text-exam-ink-soft',
  academic:    'bg-exam-accent/10 text-exam-accent',
  descriptive: 'bg-exam-alt-bg text-exam-alt',
  verbs:       'bg-exam-sage-bg text-exam-sage-strong',
  connectors:  'bg-exam-alt-bg text-exam-alt',
  nouns:       'bg-exam-accent/10 text-exam-accent',
  advanced:    'bg-exam-ink/10 text-exam-ink',
  adjectives:  'bg-exam-sage-bg text-exam-sage-strong',
};

const STORAGE_KEY = 'vocab_known_ids';
const FAV_KEY = 'vocab_favorites';
const SCHEDULE_KEY = 'vocab_known_schedule';
const TIMED_HISTORY_KEY = 'vocab_timed_history';
// A known word isn't hidden forever — it comes back for review on an
// expanding interval (Anki-style), capped here so even a word known for
// months still gets refreshed occasionally instead of aging out silently.
const VOCAB_MAX_INTERVAL_DAYS = 60;

interface KnownSchedule { interval_days: number; next_review_at: string; }
type ScheduleMap = Record<string, KnownSchedule>;

interface TimedHistoryEntry { date: string; score: number; total: number; pack: string; }

function loadTimedHistory(): TimedHistoryEntry[] {
  if (typeof window === 'undefined') return [];
  try { return JSON.parse(localStorage.getItem(TIMED_HISTORY_KEY) ?? '[]') as TimedHistoryEntry[]; }
  catch { return []; }
}
function saveTimedHistory(entries: TimedHistoryEntry[]) {
  localStorage.setItem(TIMED_HISTORY_KEY, JSON.stringify(entries.slice(-10)));
}

function loadSet(key: string): Set<string> {
  if (typeof window === 'undefined') return new Set();
  try {
    const raw = localStorage.getItem(key);
    return raw ? new Set(JSON.parse(raw) as string[]) : new Set();
  } catch { return new Set(); }
}

function saveSet(key: string, s: Set<string>) {
  localStorage.setItem(key, JSON.stringify([...s]));
}

function loadSchedule(): ScheduleMap {
  if (typeof window === 'undefined') return {};
  try {
    const raw = localStorage.getItem(SCHEDULE_KEY);
    return raw ? (JSON.parse(raw) as ScheduleMap) : {};
  } catch { return {}; }
}

function saveSchedule(schedule: ScheduleMap) {
  localStorage.setItem(SCHEDULE_KEY, JSON.stringify(schedule));
}

function dueLabel(nextReviewAt: string | undefined): string {
  if (!nextReviewAt) return '';
  const days = Math.ceil((new Date(nextReviewAt).getTime() - Date.now()) / 86_400_000);
  if (days <= 0) return 'לחזרה היום';
  if (days === 1) return 'לחזרה מחר';
  return `לחזרה בעוד ${heCount(days, 'day')}`;
}

/**
 * Retries a Supabase write a few times with backoff before giving up.
 * These known/favorite writes are otherwise fire-and-forget with nothing
 * else that ever re-syncs a single failed one — a transient blip would
 * silently leave that device's local state diverged from the account
 * forever. Returns whether it ultimately succeeded, so the caller can
 * surface a "your last change may not have saved" notice.
 */
async function writeWithRetry(fn: () => PromiseLike<{ error: unknown }>, attempts = 3): Promise<boolean> {
  for (let i = 0; i < attempts; i++) {
    try {
      const { error } = await fn();
      if (!error) return true;
    } catch {
      // fall through to retry
    }
    if (i < attempts - 1) await new Promise(r => setTimeout(r, 500 * 2 ** i));
  }
  return false;
}

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function getWrongOptions(correct: VocabWord, pool: VocabWord[]): string[] {
  const notCorrect = pool.filter(w => w.id !== correct.id && w.hebrew_translation !== correct.hebrew_translation);

  // Tier 1: same category + difficulty within 1
  const tier1 = shuffle(notCorrect.filter(w =>
    w.category === correct.category &&
    Math.abs(w.difficulty_level - correct.difficulty_level) <= 1
  ));

  // Tier 2: same category any difficulty
  const tier2 = shuffle(notCorrect.filter(w =>
    w.category === correct.category && !tier1.find(t => t.id === w.id)
  ));

  // Tier 3: same difficulty level, any category
  const tier3 = shuffle(notCorrect.filter(w =>
    w.difficulty_level === correct.difficulty_level &&
    !tier1.find(t => t.id === w.id) &&
    !tier2.find(t => t.id === w.id)
  ));

  // Tier 4: anything else
  const tier4 = shuffle(notCorrect.filter(w =>
    !tier1.find(t => t.id === w.id) &&
    !tier2.find(t => t.id === w.id) &&
    !tier3.find(t => t.id === w.id)
  ));

  const combined = [...tier1, ...tier2, ...tier3, ...tier4];
  return combined.slice(0, 3).map(w => w.hebrew_translation);
}

export default function VocabularyPage() {
  return <Suspense fallback={<div className="p-8 text-center">טוען מילים...</div>}><VocabularyContent /></Suspense>;
}

function VocabularyContent() {
  const params = useSearchParams();
  const supabase = createClient();

  // Debounced pronunciation. Component-scoped (not the module-level free
  // function this used to be) so its pending timer — and any utterance
  // already mid-speech — can be cleared on unmount: tapping the speaker
  // icon and immediately navigating away within the 150ms debounce window
  // used to leave the word audibly spoken on whatever page loads next.
  const speakTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const speak = useCallback((word: string) => {
    if (typeof window === 'undefined') return;
    if (speakTimerRef.current) clearTimeout(speakTimerRef.current);
    speakTimerRef.current = setTimeout(() => {
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(word);
      utterance.lang = 'en-US';
      utterance.rate = 0.85;
      utterance.pitch = 1;
      window.speechSynthesis.speak(utterance);
    }, 150);
  }, []);
  useEffect(() => {
    return () => {
      if (speakTimerRef.current) clearTimeout(speakTimerRef.current);
      if (typeof window !== 'undefined') window.speechSynthesis.cancel();
    };
  }, []);

  // Core state
  const [allWords, setAllWords] = useState<VocabWord[]>([]);
  const [loading, setLoading] = useState(true);
  const [known, setKnown] = useState<Set<string>>(new Set());
  const [favorites, setFavorites] = useState<Set<string>>(new Set());
  // Per-word spaced-repetition state for "known" words — when each one is
  // next due to resurface for review, Anki-style. Not reactive-deck-driving
  // on its own (see the deck-rebuild effect below) so marking a word known
  // again doesn't reshuffle the whole deck.
  const [knownSchedule, setKnownSchedule] = useState<ScheduleMap>({});
  // Bumped once, right after the DB-sync effect below applies an account's
  // real known/schedule data — the one case that SHOULD force a deck
  // rebuild despite `known`/`knownSchedule` otherwise being excluded from
  // its deps (see that effect's comment): a returning signed-in user on a
  // fresh device/session starts with an empty local `known` set, so the
  // very first deck build has nothing to exclude yet, and would otherwise
  // keep showing already-known words until an unrelated filter change.
  const [knownSyncVersion, setKnownSyncVersion] = useState(0);
  // Set when a known/favorite write to the account still failed after
  // retrying — informational only (the local change stays applied either
  // way), so the user isn't left thinking it silently worked everywhere.
  const [syncFailed, setSyncFailed] = useState(false);
  const [mode, setMode] = useState<Mode>('flashcard');
  const [userId, setUserId] = useState<string | null>(null);

  // Filters
  const [filterCat, setFilterCat] = useState<string>('');
  const [filterDiff, setFilterDiff] = useState<number>(0);
  const [search, setSearch] = useState('');
  const [activePack, setActivePack] = useState<string>(params.get('pack') ?? '');

  // ─── Flashcard state ───────────────────────────────────────────────────────
  const [deck, setDeck] = useState<VocabWord[]>([]);
  const [flipped, setFlipped] = useState(false);
  const [showHint, setShowHint] = useState(false);
  const [showKnownList, setShowKnownList] = useState(false);
  const [showFavoritesList, setShowFavoritesList] = useState(false);
  const dragStartX = useRef<number | null>(null);
  const [dragX, setDragX] = useState(0);
  const [animating, setAnimating] = useState<'left' | 'right' | null>(null);

  // ─── Quiz state ────────────────────────────────────────────────────────────
  const [quizDeck, setQuizDeck] = useState<VocabWord[]>([]);
  const [quizIndex, setQuizIndex] = useState(0);
  const [quizScore, setQuizScore] = useState({ correct: 0, total: 0 });
  const [quizSelected, setQuizSelected] = useState<number | null>(null);
  const [quizCorrect, setQuizCorrect] = useState<boolean | null>(null);
  const [quizOptions, setQuizOptions] = useState<string[]>([]);
  const [quizDone, setQuizDone] = useState(false);
  const [quizWrongWords, setQuizWrongWords] = useState<VocabWord[]>([]);

  // ─── Timed quiz state ──────────────────────────────────────────────────────
  const [timedDeck, setTimedDeck] = useState<VocabWord[]>([]);
  const [timedIndex, setTimedIndex] = useState(0);
  const [timedScore, setTimedScore] = useState(0);
  const [timedSelected, setTimedSelected] = useState<number | null>(null);
  const [timedCorrect, setTimedCorrect] = useState<boolean | null>(null);
  const [timedOptions, setTimedOptions] = useState<string[]>([]);
  const [timedDone, setTimedDone] = useState(false);
  const [timedResults, setTimedResults] = useState<TimedResult[]>([]);
  const [timeLeft, setTimeLeft] = useState(20);
  const [wordStart, setWordStart] = useState(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const timedIndexRef = useRef(0);
  // Mirrors timeLeft for the interval tick below to read synchronously —
  // same pattern as timedIndexRef, needed so the tick can decide "did this
  // second hit zero" as a plain read instead of inside a setState updater
  // (that updater used to run several other setState calls and schedule a
  // setTimeout as a side effect of computing the next value, which React
  // is allowed to invoke more than once for a single state transition).
  const timeLeftRef = useRef(20);
  const [timedWordCount, setTimedWordCount] = useState<5 | 10 | 20>(10);
  const [timedTimePerWord, setTimedTimePerWord] = useState<10 | 15 | 20 | 30>(20);
  const [showTimedConfig, setShowTimedConfig] = useState(false);
  const [showFilterDrawer, setShowFilterDrawer] = useState(false);

  // Guest identity is a signed, HttpOnly cookie the server issues — this
  // just makes sure it exists before the first request on a page a guest
  // might land on directly (the server never trusts a client-supplied
  // guestId, so nothing here needs to read it back — see src/lib/guest.ts).
  useEffect(() => { ensureGuestIdentity().catch(() => {}); }, []);

  // ─── Personal pack: words from the user's own SC mistakes ─────────────────
  const [myWords, setMyWords] = useState<VocabWord[]>([]);
  useEffect(() => {
    authFetch('/api/my-words')
      .then(r => (r.ok ? r.json() : { words: [] }))
      .then((d: { words: VocabWord[] }) => setMyWords(d.words ?? []))
      .catch(() => {});
  }, []);

  // ─── Load auth user ────────────────────────────────────────────────────────
  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      setUserId(user?.id ?? null);
    });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_e, session) => {
      setUserId(session?.user?.id ?? null);
    });
    return () => subscription.unsubscribe();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ─── Sync known/favorites from DB when user logs in ───────────────────────
  useEffect(() => {
    if (!userId) return;
    Promise.all([
      supabase.from('user_vocab_known').select('word_id, interval_days, next_review_at').eq('user_id', userId),
      supabase.from('user_vocab_favorites').select('word_id').eq('user_id', userId),
    ]).then(([knownRes, favRes]) => {
      if (knownRes.data) {
        type KnownRow = { word_id: string; interval_days: number; next_review_at: string };
        const rows = knownRes.data as KnownRow[];
        const s = new Set(rows.map(r => r.word_id));
        setKnown(s);
        saveSet(STORAGE_KEY, s);
        const schedule: ScheduleMap = Object.fromEntries(
          rows.map(r => [r.word_id, { interval_days: r.interval_days, next_review_at: r.next_review_at }])
        );
        setKnownSchedule(schedule);
        saveSchedule(schedule);
      }
      if (favRes.data) {
        const s = new Set(favRes.data.map((r: { word_id: string }) => r.word_id));
        setFavorites(s);
        saveSet(FAV_KEY, s);
      }
      // Force exactly one deck rebuild now that the account's real known/
      // schedule data has landed — see knownSyncVersion's declaration.
      setKnownSyncVersion(v => v + 1);
    });
  }, [userId]); // eslint-disable-line react-hooks/exhaustive-deps

  // ─── Load from storage and DB ──────────────────────────────────────────────
  useEffect(() => {

    const VOCAB_CACHE_KEY = 'vocab_cache_v3';
    const VOCAB_CACHE_TTL = 6 * 60 * 60 * 1000; // 6h

    const fetchAll = async () => {
      // Try cache first
      try {
        const raw = localStorage.getItem(VOCAB_CACHE_KEY);
        if (raw) {
          const { data, ts } = JSON.parse(raw) as { data: VocabWord[]; ts: number };
          if (Date.now() - ts < VOCAB_CACHE_TTL && data.length > 0) {
            setAllWords(shuffle(data));
            setLoading(false);
            return;
          }
        }
      } catch { /* cache miss */ }

      // Fetch from DB in pages (Supabase caps at 1000 rows)
      const PAGE = 1000;
      let all: VocabWord[] = [];
      let from = 0;
      while (true) {
        const { data } = await supabase
          .from('vocabulary')
          .select('*')
          .order('id')
          .range(from, from + PAGE - 1);
        const rows = (data ?? []) as VocabWord[];
        all = [...all, ...rows];
        if (rows.length < PAGE) break;
        from += PAGE;
      }
      const shuffled = shuffle(all);
      setAllWords(shuffled);
      setLoading(false);

      // Persist to cache (pre-shuffled so every load is random)
      try {
        localStorage.setItem(VOCAB_CACHE_KEY, JSON.stringify({ data: shuffled, ts: Date.now() }));
      } catch { /* storage full */ }
    };
    void Promise.resolve().then(() => {
      setKnown(loadSet(STORAGE_KEY));
      setFavorites(loadSet(FAV_KEY));
      setKnownSchedule(loadSchedule());
      return fetchAll();
    });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ─── Themed packs definition ───────────────────────────────────────────────
  const THEMED_PACKS = [
    ...(myWords.length > 0 ? [{ id: 'my-mistakes', icon: TrendingDown, label: `המילים שהפילו אותי (${myWords.length})`, filter: (w: VocabWord) => w.category === 'my-mistakes' }] : []),
    { id: 'verbs',      icon: Zap,            label: 'פעלים חזקים',    filter: (w: VocabWord) => w.category === 'verbs' },
    { id: 'connectors', icon: Link2,          label: 'מחברים ומעברים', filter: (w: VocabWord) => w.category === 'connectors' },
    { id: 'academic',   icon: GraduationCap,  label: 'אקדמי',           filter: (w: VocabWord) => w.category === 'academic' },
    { id: 'advanced',   icon: Flame,          label: 'מתקדם',           filter: (w: VocabWord) => w.difficulty_level >= 4 },
    { id: 'easy',       icon: CheckCircle2,   label: 'קל להתחלה',       filter: (w: VocabWord) => w.difficulty_level <= 2 },
    { id: 'adjectives', icon: Palette,        label: 'תיאורים',         filter: (w: VocabWord) => w.category === 'adjectives' || w.category === 'descriptive' },
    { id: 'nouns',      icon: Package,        label: 'שמות עצם',        filter: (w: VocabWord) => w.category === 'nouns' },
    { id: 'favorites',  icon: Heart,          label: 'מועדפים',         filter: (w: VocabWord) => favorites.has(w.id) },
  ];

  // ─── Compute filtered words ────────────────────────────────────────────────
  const filteredWords = (() => {
    // The personal mistakes pack is synthesized from wrong answers, not the vocab table
    let filtered = activePack === 'my-mistakes' ? myWords : allWords;

    // Apply themed pack first if active
    if (activePack && activePack !== 'my-mistakes') {
      const pack = THEMED_PACKS.find(p => p.id === activePack);
      if (pack) filtered = filtered.filter(pack.filter);
    }

    if (filterCat) filtered = filtered.filter(w => w.category === filterCat);
    if (filterDiff) filtered = filtered.filter(w => w.difficulty_level === filterDiff);
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      filtered = filtered.filter(w =>
        w.word.toLowerCase().includes(q) ||
        w.hebrew_translation.includes(q) ||
        w.definition.toLowerCase().includes(q) ||
        w.example_sentence.toLowerCase().includes(q)
      );
    }
    return filtered;
  })();

  // Progress ("ידעת X / Y") is scoped to the active filter/pack, not the full
  // 1158-word bank — otherwise finishing a 20-word themed pack always showed
  // ~0-2%, which read as broken rather than "you finished this set."
  const hasActiveFilter = !!(filterCat || filterDiff || search.trim() || activePack);
  const progressScopeTotal = hasActiveFilter ? filteredWords.length : allWords.length;
  const progressScopeKnown = hasActiveFilter ? filteredWords.filter(w => known.has(w.id)).length : known.size;

  // ─── Rebuild flashcard deck on filter change ───────────────────────────────
  // Only depend on favorites contents when the favorites pack itself is active —
  // otherwise toggling ❤️ on the current card (which changes the `favorites` Set
  // reference on every click) reshuffled the whole deck and jumped the user to a
  // random card, losing their place mid-study.
  //
  // `known`/`knownSchedule` are deliberately NOT dependencies here for the same
  // reason: marking a card "ידעתי" already removes it from the deck directly
  // (see handleKnew's `setDeck(prev => prev.slice(1))`), so re-running this
  // effect on every known-set change reshuffled the entire remaining deck and
  // threw away the deferred ordering handleUnknown relies on to push "לא
  // ידעתי" cards toward the end. The `known.has()`/due-check below still
  // applies correctly on every genuine rebuild (filter/pack change, or a
  // fresh DB sync via knownSyncVersion) — it just doesn't need every local
  // swipe to re-trigger the rebuild itself. A known word only re-enters the
  // deck once its spaced-repetition interval says it's due again — otherwise
  // it stays hidden, same as before.
  const favoritesSignature = activePack === 'favorites' ? Array.from(favorites).sort().join(',') : '';
  useEffect(() => {
    if (!allWords.length) return;
    // Always shuffle from scratch so deck order is never derived from allWords order
    const active = shuffle(filteredWords).filter(w => {
      if (!known.has(w.id)) return true;
      const sched = knownSchedule[w.id];
      return !sched || isDue(sched.next_review_at);
    });
    const frame = requestAnimationFrame(() => {
      setDeck(active);
      setFlipped(false);
      setShowHint(false);
    });
    return () => cancelAnimationFrame(frame);
  }, [allWords, filterCat, filterDiff, search, activePack, favoritesSignature, knownSyncVersion]); // eslint-disable-line react-hooks/exhaustive-deps

  // ─── Build quiz options for current question ───────────────────────────────
  const buildQuizOptions = useCallback((word: VocabWord, pool: VocabWord[]): string[] => {
    let wrong = getWrongOptions(word, pool);
    if (wrong.length < 3) {
      // A narrow filtered/pack pool can run out of distinct-translation
      // distractors, silently rendering a 2-3-option question. Fall back to
      // the full bank so the quiz always has 4 options when one exists.
      wrong = getWrongOptions(word, allWords);
    }
    const all = shuffle([word.hebrew_translation, ...wrong]);
    return all;
  }, [allWords]);

  // ─── Start quiz ────────────────────────────────────────────────────────────
  const startQuiz = useCallback(() => {
    const shuffled = shuffle(filteredWords);
    setQuizDeck(shuffled);
    setQuizIndex(0);
    setQuizScore({ correct: 0, total: 0 });
    setQuizSelected(null);
    setQuizCorrect(null);
    setQuizDone(false);
    setQuizWrongWords([]);
    if (shuffled.length > 0) {
      setQuizOptions(buildQuizOptions(shuffled[0], shuffled));
    }
  }, [filteredWords, buildQuizOptions]);

  // ─── Start timed quiz ──────────────────────────────────────────────────────
  const startTimed = useCallback((wordCount = timedWordCount, timePerWord = timedTimePerWord) => {
    const shuffled = shuffle(filteredWords).slice(0, wordCount);
    timedIndexRef.current = 0;
    setTimedDeck(shuffled);
    setTimedIndex(0);
    setTimedScore(0);
    setTimedSelected(null);
    setTimedCorrect(null);
    setTimedDone(false);
    setTimedResults([]);
    timeLeftRef.current = timePerWord;
    setTimeLeft(timePerWord);
    setWordStart(Date.now());
    setShowTimedConfig(false);
    if (shuffled.length > 0) {
      setTimedOptions(buildQuizOptions(shuffled[0], filteredWords));
    }
  }, [filteredWords, buildQuizOptions, timedWordCount, timedTimePerWord]);

  // Sync timedIndex/timeLeft to refs (fix stale closure in timer)
  useEffect(() => { timedIndexRef.current = timedIndex; }, [timedIndex]);
  useEffect(() => { timeLeftRef.current = timeLeft; }, [timeLeft]);

  // Switching modes preserves an unfinished run; filters apply to the next run.
  const changeMode = (nextMode: Mode) => {
    setMode(nextMode);
    if (nextMode === 'quiz' && allWords.length > 0 && (quizDeck.length === 0 || quizDone)) startQuiz();
    if (nextMode === 'timed' && allWords.length > 0 && (timedDeck.length === 0 || timedDone)) setShowTimedConfig(true);
  };

  const advanceTimed = useCallback((results: TimedResult[]) => {
    const nextIndex = timedIndexRef.current + 1;
    if (nextIndex >= timedDeck.length) {
      const finalScore = results.filter(r => r.correct).length;
      setTimedDone(true);
      setTimedScore(finalScore);
      // Save to history
      const entry: TimedHistoryEntry = {
        date: new Date().toLocaleDateString('he-IL'),
        score: finalScore,
        total: timedDeck.length,
        pack: activePack || 'כל המילים',
      };
      saveTimedHistory([...loadTimedHistory(), entry]);
      return;
    }
    timedIndexRef.current = nextIndex;
    setTimedIndex(nextIndex);
    setTimedSelected(null);
    setTimedCorrect(null);
    timeLeftRef.current = timedTimePerWord;
    setTimeLeft(timedTimePerWord);
    setWordStart(Date.now());
    setTimedOptions(buildQuizOptions(timedDeck[nextIndex], filteredWords.length > 0 ? filteredWords : timedDeck));
  }, [timedDeck, filteredWords, buildQuizOptions, timedTimePerWord, activePack]);

  // ─── Timed quiz timer ──────────────────────────────────────────────────────
  useEffect(() => {
    if (mode !== 'timed' || timedDone || timedSelected !== null) return;
    if (timedDeck.length === 0) return;

    timerRef.current = setInterval(() => {
      // Plain read-then-write against the ref, not a setState updater —
      // an updater is expected to be pure, but this used to run several
      // other setState calls and schedule a setTimeout as a side effect of
      // computing the next value, which React is allowed to invoke more
      // than once for a single state transition (double-recording the
      // result / double-scheduling the advance).
      if (timeLeftRef.current <= 1) {
        clearInterval(timerRef.current!);
        timeLeftRef.current = 0;
        setTimeLeft(0);
        const cur = timedDeck[timedIndexRef.current];
        if (!cur) return;
        const elapsed = (Date.now() - wordStart) / 1000;
        const newResults = [...timedResults, { word: cur, correct: false, timeTaken: elapsed }];
        setTimedResults(newResults);
        setTimedCorrect(false);
        setTimedSelected(-1);
        setTimeout(() => advanceTimed(newResults), 1000);
        return;
      }
      timeLeftRef.current -= 1;
      setTimeLeft(timeLeftRef.current);
    }, 1000);

    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [mode, timedIndex, timedDone, timedSelected, timedDeck]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleTimedSelect = (optionIndex: number, option: string, answeredAt: number) => {
    if (timedSelected !== null || timedDone) return;
    if (timerRef.current) clearInterval(timerRef.current);

    const cur = timedDeck[timedIndex];
    const isCorrect = option === cur.hebrew_translation;
    const elapsed = (answeredAt - wordStart) / 1000;
    const newResults = [...timedResults, { word: cur, correct: isCorrect, timeTaken: elapsed }];

    setTimedResults(newResults);
    setTimedSelected(optionIndex);
    setTimedCorrect(isCorrect);
    if (isCorrect) setTimedScore(prev => prev + 1);

    setTimeout(() => advanceTimed(newResults), 1200);
  };

  // ─── Quiz advance ──────────────────────────────────────────────────────────
  const handleQuizSelect = (optionIndex: number, option: string) => {
    if (quizSelected !== null || quizDone) return;
    const cur = quizDeck[quizIndex];
    const isCorrect = option === cur.hebrew_translation;
    setQuizSelected(optionIndex);
    setQuizCorrect(isCorrect);
    setQuizScore(prev => ({ correct: prev.correct + (isCorrect ? 1 : 0), total: prev.total + 1 }));
    if (!isCorrect) setQuizWrongWords(prev => [...prev, cur]);
  };

  const handleQuizNext = () => {
    const nextIndex = quizIndex + 1;
    if (nextIndex >= quizDeck.length) {
      setQuizDone(true);
      return;
    }
    setQuizIndex(nextIndex);
    setQuizSelected(null);
    setQuizCorrect(null);
    setQuizOptions(buildQuizOptions(quizDeck[nextIndex], quizDeck));
  };

  // ─── Favorites ─────────────────────────────────────────────────────────────
  const toggleFavorite = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const next = new Set(favorites);
    const removing = next.has(id);
    if (removing) next.delete(id);
    else next.add(id);
    setFavorites(next);
    saveSet(FAV_KEY, next);
    if (userId) {
      const write = removing
        ? () => supabase.from('user_vocab_favorites').delete().eq('user_id', userId).eq('word_id', id)
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        : () => (supabase.from('user_vocab_favorites') as any).upsert({ user_id: userId, word_id: id });
      writeWithRetry(write).then(ok => { if (!ok) setSyncFailed(true); });
    }
  };

  const removeFavorite = (id: string) => {
    const next = new Set(favorites);
    next.delete(id);
    setFavorites(next);
    saveSet(FAV_KEY, next);
    if (userId) {
      writeWithRetry(() => supabase.from('user_vocab_favorites').delete().eq('user_id', userId).eq('word_id', id))
        .then(ok => { if (!ok) setSyncFailed(true); });
    }
  };

  const clearAllFavorites = () => {
    setFavorites(new Set());
    saveSet(FAV_KEY, new Set());
    if (userId) {
      writeWithRetry(() => supabase.from('user_vocab_favorites').delete().eq('user_id', userId))
        .then(ok => { if (!ok) setSyncFailed(true); });
    }
  };

  // ─── Flashcard handlers ────────────────────────────────────────────────────
  const current = deck[0] ?? null;

  const handleKnew = useCallback(() => {
    if (!current || animating) return;
    const wordId = current.id;
    // Anki-style: first time known → due again in 1 day; each time it
    // resurfaces (already due) and gets confirmed known again → the
    // interval doubles, capped so it never stops coming back entirely.
    const prevSched = knownSchedule[wordId];
    const newInterval = prevSched ? nextInterval(prevSched.interval_days, VOCAB_MAX_INTERVAL_DAYS) : 1;
    const nextReviewAt = addDays(new Date(), newInterval).toISOString();
    setAnimating('right');
    setTimeout(() => {
      const next = new Set(known);
      next.add(wordId);
      setKnown(next);
      saveSet(STORAGE_KEY, next);
      const nextSchedule = { ...knownSchedule, [wordId]: { interval_days: newInterval, next_review_at: nextReviewAt } };
      setKnownSchedule(nextSchedule);
      saveSchedule(nextSchedule);
      setDeck(prev => prev.slice(1));
      setFlipped(false);
      setShowHint(false);
      setDragX(0);
      setAnimating(null);
      if (userId) {
        writeWithRetry(() => supabase.from('user_vocab_known')
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          .upsert({ user_id: userId, word_id: wordId, interval_days: newInterval, next_review_at: nextReviewAt } as any))
          .then(ok => { if (!ok) setSyncFailed(true); });
      }
    }, 280);
  }, [current, known, knownSchedule, userId, animating]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleUnknown = useCallback(() => {
    if (!current || animating) return;
    const wordId = current.id;
    // A lapse: this card only reappeared because it was a "known" word due
    // for review, and the student didn't actually recall it — reset its
    // interval back to 1 day instead of leaving the old (now clearly wrong)
    // long interval in place, same reset-on-failure the review queue uses.
    const isLapse = known.has(wordId);
    const nextReviewAt = addDays(new Date(), 1).toISOString();
    setAnimating('left');
    setTimeout(() => {
      setDeck(prev => [...prev.slice(1), prev[0]]);
      setFlipped(false);
      setShowHint(false);
      setDragX(0);
      setAnimating(null);
      if (isLapse) {
        const nextSchedule = { ...knownSchedule, [wordId]: { interval_days: 1, next_review_at: nextReviewAt } };
        setKnownSchedule(nextSchedule);
        saveSchedule(nextSchedule);
        if (userId) {
          writeWithRetry(() => supabase.from('user_vocab_known')
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            .upsert({ user_id: userId, word_id: wordId, interval_days: 1, next_review_at: nextReviewAt } as any))
            .then(ok => { if (!ok) setSyncFailed(true); });
        }
      }
    }, 280);
  }, [current, known, knownSchedule, userId, animating]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleReturnToKnown = (wordId: string) => {
    const next = new Set(known);
    next.delete(wordId);
    setKnown(next);
    saveSet(STORAGE_KEY, next);
    setKnownSchedule(prev => {
      const rest = { ...prev };
      delete rest[wordId];
      saveSchedule(rest);
      return rest;
    });
    if (userId) {
      writeWithRetry(() => supabase.from('user_vocab_known').delete().eq('user_id', userId).eq('word_id', wordId))
        .then(ok => { if (!ok) setSyncFailed(true); });
    }
  };

  const handleResetAll = () => {
    setKnown(new Set());
    saveSet(STORAGE_KEY, new Set());
    setKnownSchedule({});
    saveSchedule({});
    setShowKnownList(false);
    if (userId) {
      writeWithRetry(() => supabase.from('user_vocab_known').delete().eq('user_id', userId))
        .then(ok => { if (!ok) setSyncFailed(true); });
    }
  };

  const onDragStart = (clientX: number) => { dragStartX.current = clientX; };
  const onDragMove = (clientX: number) => {
    if (dragStartX.current === null || animating) return;
    setDragX(clientX - dragStartX.current);
  };
  const onDragEnd = () => {
    if (animating) return;
    if (dragX > 80) handleKnew();
    else if (dragX < -80) handleUnknown();
    else setDragX(0);
    dragStartX.current = null;
  };

  useEffect(() => {
    if (mode !== 'flashcard') return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight') handleKnew();
      else if (e.key === 'ArrowLeft') handleUnknown();
      else if (e.key === ' ') { e.preventDefault(); setFlipped(f => !f); }
      else if (e.key === 'h' || e.key === 'H') setShowHint(h => !h);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [handleKnew, handleUnknown, mode]);

  const knownWords = allWords.filter(w => known.has(w.id));
  const rotate = animating === 'right' ? 20 : animating === 'left' ? -20 : dragX * 0.06;
  const tx = animating === 'right' ? 400 : animating === 'left' ? -400 : dragX;
  const knewOpacity = Math.min(1, Math.max(0, (animating === 'right' ? 1 : dragX) / 100));
  const unknownOpacity = Math.min(1, Math.max(0, (animating === 'left' ? 1 : -dragX) / 100));
  // The face clears out under the swipe color before the label is strong.
  const faceOpacity = 1 - Math.min(1, 2 * Math.max(knewOpacity, unknownOpacity));

  const categoryCounts = allWords.reduce<Record<string, number>>((acc, w) => { acc[w.category] = (acc[w.category] ?? 0) + 1; return acc; }, {});
  const categories = [...new Set(allWords.map(w => w.category))].filter(c => categoryCounts[c] >= 5).sort();

  // ─── Timer bar color ───────────────────────────────────────────────────────
  const timerColor = timeLeft > timedTimePerWord * 0.5 ? 'bg-exam-sage-strong' : timeLeft > timedTimePerWord * 0.25 ? 'bg-exam-alt' : 'bg-exam-wrong';

  if (loading) {
    return (
      <div className="min-h-dvh bg-exam-paper flex items-center justify-center" dir="rtl">
        <div className="text-exam-ink-soft text-lg">טוען מילים...</div>
      </div>
    );
  }

  return (
    <div className="min-h-dvh bg-exam-paper" dir="rtl">
      <BackNav backHref="/" backLabel="דף הבית" />

      <div className="max-w-lg mx-auto px-4 pt-4 pb-32">
        {syncFailed && (
          <div className="mb-4 flex items-center gap-2 px-3 py-2.5 bg-exam-alt-bg border border-exam-alt/40 rounded-sm text-sm text-exam-alt">
            <AlertTriangle className="w-4 h-4 flex-shrink-0" aria-hidden />
            <span className="flex-1">השינוי האחרון נשמר במכשיר הזה, אבל עוד לא בחשבון. בדוק את החיבור לאינטרנט.</span>
            <button onClick={() => setSyncFailed(false)} className="flex-shrink-0 hover:opacity-70" aria-label="סגור">
              <X className="w-4 h-4" aria-hidden />
            </button>
          </div>
        )}
        <div className="flex items-center justify-between mb-4">
          <h1 className="text-2xl font-bold text-exam-ink flex items-center gap-2"><BookOpen className="w-6 h-6" strokeWidth={1.5} aria-hidden />אוצר מילים</h1>
          <button
            onClick={() => setShowFavoritesList(true)}
            className="hit-44 flex items-center gap-1.5 px-3 py-2 rounded-sm bg-exam-wrong-bg border border-exam-wrong/40 text-exam-wrong font-semibold text-sm hover:opacity-80 transition-opacity"
          >
            <Heart className="w-4 h-4" aria-hidden />
            <span>מועדפים</span>
            {favorites.size > 0 && (
              <span className="bg-exam-wrong text-on-danger text-xs rounded-full w-5 h-5 flex items-center justify-center font-bold">
                {favorites.size}
              </span>
            )}
          </button>
        </div>

        {/* ── Favorites Panel ───────────────────────────────────────────────── */}
        {showFavoritesList && (
          <div className="fixed inset-0 z-50 bg-black/40 flex items-end justify-center" onClick={() => setShowFavoritesList(false)}>
            <div
              className="bg-exam-surface rounded-t-md w-full max-w-lg max-h-[80dvh] flex flex-col"
              onClick={e => e.stopPropagation()}
            >
              {/* Header */}
              <div className="flex items-center justify-between px-5 py-4 border-b border-exam-border">
                <div className="flex items-center gap-2">
                  <Heart className="w-5 h-5 text-exam-wrong" fill="currentColor" aria-hidden />
                  <span className="font-bold text-exam-ink text-lg">מילים שמורות</span>
                  <span className="bg-exam-wrong-bg text-exam-wrong text-xs font-bold px-2 py-0.5 rounded-sm">{favorites.size}</span>
                </div>
                <button onClick={() => setShowFavoritesList(false)} className="text-exam-ink-soft hover:text-exam-ink text-2xl leading-none">×</button>
              </div>

              {/* Actions */}
              {favorites.size > 0 && (
                <div className="px-5 py-3 flex gap-2 border-b border-exam-border">
                  <button
                    onClick={() => {
                      setActivePack('favorites');
                      setShowFavoritesList(false);
                    }}
                    className="flex-1 py-2 bg-exam-accent text-exam-accent-ink rounded-sm text-sm font-semibold hover:opacity-90 transition-opacity"
                  >תרגל מועדפים בלבד ←</button>
                  <button
                    onClick={() => {
                      if (!window.confirm(`למחוק את כל ${favorites.size} המועדפים?`)) return;
                      clearAllFavorites();
                    }}
                    className="px-3 py-2 bg-exam-paper-alt text-exam-ink-soft rounded-sm text-sm hover:bg-exam-border/30 transition-colors"
                  >נקה הכל</button>
                </div>
              )}

              {/* List */}
              <div className="overflow-y-auto flex-1 px-5 py-3">
                {favorites.size === 0 ? (
                  <div className="text-center py-12">
                    <Heart className="w-10 h-10 mx-auto mb-3 text-exam-ink-soft" strokeWidth={1.5} aria-hidden />
                    <p className="text-exam-ink-soft text-sm">הרשימה שלך עוד ריקה.</p>
                    <p className="text-exam-ink-soft text-xs mt-1 flex items-center justify-center gap-1">לחץ <Heart className="inline w-3.5 h-3.5" aria-hidden /> על כרטיסייה כדי לשמור אותה כאן.</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {allWords.filter(w => favorites.has(w.id)).map((w, i) => (
                      <div
                        key={w.id}
                        style={{ animationDelay: `${Math.min(i, 12) * 35}ms` }}
                        className="flex items-center justify-between p-3 bg-exam-paper-alt rounded-xl border border-exam-border animate-fade-up"
                      >
                        <div dir="ltr" className="flex-1 min-w-0">
                          <div className="flex items-center gap-1.5">
                            <div className="font-serif font-bold text-exam-ink text-sm">{w.word}</div>
                            {known.has(w.id) && (
                              <span dir="rtl" className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-sm bg-exam-sage-bg text-exam-sage-strong text-[10px] font-semibold">
                                <Check className="w-2.5 h-2.5" strokeWidth={3} aria-hidden />ידוע
                              </span>
                            )}
                          </div>
                          <div className="text-exam-ink-soft text-xs mt-0.5">{w.hebrew_translation}</div>
                          {w.example_sentence && (
                            <div dir="ltr" className="font-serif text-exam-ink-soft text-xs mt-0.5 italic truncate text-right">{w.example_sentence}</div>
                          )}
                        </div>
                        <div className="flex items-center gap-2 mr-3 flex-shrink-0">
                          <button onClick={() => speak(w.word)} className="hover:scale-110 transition-transform text-exam-ink-soft"><Volume2 className="w-4 h-4" aria-hidden /></button>
                          <button
                            onClick={() => removeFavorite(w.id)}
                            aria-label={`הסר את ${w.word} מהמועדפים`}
                            title="הסר מהמועדפים"
                            className="flex items-center gap-1 px-2 py-1 rounded-sm text-exam-wrong hover:text-on-danger hover:bg-exam-wrong border border-exam-wrong/40 text-xs font-semibold transition-colors"
                          >
                            <Trash2 className="w-3.5 h-3.5" aria-hidden />
                            <span>הסר</span>
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* ── Mode Switcher ─────────────────────────────────────────────────── */}
        <div className="flex rounded-sm bg-exam-paper-alt p-1 mb-5 gap-1">
          {([
            { id: 'flashcard', label: 'כרטיסיות' },
            { id: 'quiz',      label: 'חידון' },
            { id: 'timed',     label: 'מבחן מהיר' },
          ] as { id: Mode; label: string }[]).map(m => (
            <button
              key={m.id}
              onClick={() => changeMode(m.id)}
              className={`hit-44 flex-1 py-2 rounded-xl text-sm font-semibold transition-[background-color,color,box-shadow,transform] duration-300 ease-spring active:scale-[0.96] ${mode === m.id ? 'bg-exam-surface text-exam-ink shadow-surface' : 'text-exam-ink-soft hover:text-exam-ink'}`}
            >{m.label}</button>
          ))}
        </div>

        {mode === 'quiz' && quizDeck.length > 0 && !quizDone && (
          <p className="text-sm text-exam-ink-soft mb-3">שינויי סינון יחולו בחידון הבא. החידון הנוכחי נשמר.</p>
        )}
        {/* ── Filter button + active chips ──────────────────────────────────── */}
        {(() => {
          const hasActive = !!(activePack || filterCat || filterDiff || search);
          const activeCount = [activePack, filterCat, filterDiff > 0, search.trim()].filter(Boolean).length;
          return (
            <div className="mb-5">
              <div className="flex items-center gap-2 flex-wrap">
                <button
                  onClick={() => setShowFilterDrawer(true)}
                  className={`hit-44 flex items-center gap-2 px-4 py-2 rounded-xl border text-sm font-semibold shadow-surface hover:shadow-raised active:shadow-pressed active:scale-[0.96] transition-[background-color,border-color,box-shadow,transform] duration-300 ease-spring will-change-transform ${hasActive ? 'bg-exam-accent text-exam-accent-ink border-exam-accent' : 'bg-exam-surface text-exam-ink-soft border-exam-border hover:border-exam-border-strong'}`}
                >
                  <Search className="inline w-4 h-4 ml-1" strokeWidth={1.75} aria-hidden />סינון{activeCount > 0 ? ` (${activeCount})` : ''}
                </button>
                {activePack && (
                  <span className="flex items-center gap-1 px-2.5 py-1 bg-exam-accent/10 text-exam-accent rounded-sm text-xs font-medium">
                    {THEMED_PACKS.find(p => p.id === activePack)?.label}
                    <button onClick={() => setActivePack('')} className="hover:opacity-70 font-bold leading-none">×</button>
                  </span>
                )}
                {filterCat && (
                  <span className="flex items-center gap-1 px-2.5 py-1 bg-exam-paper-alt text-exam-ink-soft rounded-sm text-xs font-medium">
                    {CATEGORY_LABELS[filterCat] ?? filterCat}
                    <button onClick={() => setFilterCat('')} className="hover:text-exam-ink font-bold leading-none">×</button>
                  </span>
                )}
                {filterDiff > 0 && (
                  <span className="flex items-center gap-1 px-2.5 py-1 bg-exam-alt-bg text-exam-alt rounded-sm text-xs font-medium">
                    <StarRow n={filterDiff} />
                    <button onClick={() => setFilterDiff(0)} className="hover:opacity-70 font-bold leading-none">×</button>
                  </span>
                )}
                {search.trim() && (
                  <span className="flex items-center gap-1 px-2.5 py-1 bg-exam-sage-bg text-exam-sage-strong rounded-sm text-xs font-medium max-w-[140px]">
                    <span className="truncate">&quot;<bdi>{search}</bdi>&quot;</span>
                    <button onClick={() => setSearch('')} aria-label="ניקוי החיפוש" className="hit-44 hover:text-exam-sage-strong font-bold leading-none flex-shrink-0">×</button>
                  </span>
                )}
              </div>
            </div>
          );
        })()}

        {/* ── Filter drawer ─────────────────────────────────────────────────── */}
        {showFilterDrawer && (
          <div className="fixed inset-0 z-50 bg-black/40 flex items-end justify-center" onClick={() => setShowFilterDrawer(false)}>
            <div className="bg-exam-surface rounded-t-md w-full max-w-lg max-h-[85dvh] flex flex-col" onClick={e => e.stopPropagation()}>
              <div className="flex items-center justify-between px-5 py-4 border-b border-exam-border">
                <span className="font-bold text-exam-ink text-lg">סינון מילים</span>
                <div className="flex items-center gap-4">
                  {!!(activePack || filterCat || filterDiff || search) && (
                    <button
                      onClick={() => { setActivePack(''); setFilterCat(''); setFilterDiff(0); setSearch(''); }}
                      className="text-sm text-exam-wrong font-semibold"
                    >נקה הכל</button>
                  )}
                  <button onClick={() => setShowFilterDrawer(false)} className="text-2xl text-exam-ink-soft leading-none hover:text-exam-ink">×</button>
                </div>
              </div>

              <div className="overflow-y-auto px-5 py-5 space-y-6">
                {/* Themed packs */}
                <div>
                  <div className="text-xs font-bold text-exam-ink-soft uppercase tracking-wide mb-3">סטים נושאיים</div>
                  <div className="flex flex-wrap gap-2">
                    {THEMED_PACKS.map(pack => (
                      <button
                        key={pack.id}
                        onClick={() => setActivePack(activePack === pack.id ? '' : pack.id)}
                        className={`px-3 py-1.5 rounded-xl text-sm font-medium border transition-[background-color,border-color,transform] duration-300 ease-spring active:scale-[0.94] flex items-center gap-1.5 ${activePack === pack.id ? 'bg-exam-accent text-exam-accent-ink border-exam-accent' : 'bg-exam-surface text-exam-ink-soft border-exam-border hover:border-exam-border-strong'}`}
                      ><pack.icon className="w-3.5 h-3.5" strokeWidth={1.75} aria-hidden />{pack.label}</button>
                    ))}
                  </div>
                </div>

                {/* Categories */}
                <div>
                  <div className="text-xs font-bold text-exam-ink-soft uppercase tracking-wide mb-3">קטגוריה</div>
                  <div className="flex flex-wrap gap-2">
                    <button onClick={() => setFilterCat('')} className={`px-3 py-1.5 rounded-xl text-sm font-medium border transition-[background-color,border-color,transform] duration-300 ease-spring active:scale-[0.94] ${!filterCat ? 'bg-exam-accent text-exam-accent-ink border-exam-accent' : 'bg-exam-surface text-exam-ink-soft border-exam-border hover:border-exam-border-strong'}`}>הכל</button>
                    {categories.map(cat => (
                      <button key={cat} onClick={() => setFilterCat(cat === filterCat ? '' : cat)} className={`px-3 py-1.5 rounded-xl text-sm font-medium border transition-[background-color,border-color,transform] duration-300 ease-spring active:scale-[0.94] ${filterCat === cat ? 'bg-exam-accent text-exam-accent-ink border-exam-accent' : 'bg-exam-surface text-exam-ink-soft border-exam-border hover:border-exam-border-strong'}`}>{CATEGORY_LABELS[cat] ?? cat}</button>
                    ))}
                  </div>
                </div>

                {/* Difficulty */}
                <div>
                  <div className="text-xs font-bold text-exam-ink-soft uppercase tracking-wide mb-3">רמה</div>
                  {/* Six even columns: "all" + levels 1–5, each a number with a
                      single star — a full 5-star row can't fit a chip this size. */}
                  <div className="grid grid-cols-6 gap-2" dir="rtl">
                    {[0, 1, 2, 3, 4, 5].map(d => {
                      const selected = filterDiff === d;
                      return (
                        <button
                          key={d}
                          type="button"
                          onClick={() => setFilterDiff(d === filterDiff ? 0 : d)}
                          aria-pressed={selected}
                          aria-label={d === 0 ? 'כל הרמות' : `רמה ${d} מתוך 5`}
                          className={`h-11 rounded-xl border text-sm font-bold inline-flex items-center justify-center gap-1 transition-[background-color,color,border-color,box-shadow,transform] duration-300 ease-spring active:scale-[0.92] ${
                            selected
                              ? 'bg-exam-accent text-exam-accent-ink border-exam-accent shadow-surface'
                              : 'bg-exam-surface text-exam-ink border-exam-border hover:border-exam-border-strong hover:shadow-surface'
                          }`}
                        >
                          {d === 0 ? 'הכל' : (
                            <>
                              <span className="tabular-nums">{d}</span>
                              <Star className={`w-3.5 h-3.5 fill-current ${selected ? '' : 'text-exam-alt'}`} aria-hidden />
                            </>
                          )}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Search */}
                <div>
                  <div className="text-xs font-bold text-exam-ink-soft uppercase tracking-wide mb-3">חיפוש</div>
                  <input
                    type="text"
                    value={search}
                    onChange={e => setSearch(e.target.value)}
                    dir="auto"
                    placeholder="חפש מילה בעברית או באנגלית"
                    className="w-full px-4 py-3 rounded-sm border border-exam-border bg-exam-paper-alt text-sm focus:outline-none focus:border-exam-accent text-start placeholder:text-right text-exam-ink"
                  />
                </div>
              </div>

              <div className="px-5 py-4 border-t border-exam-border">
                <button
                  onClick={() => setShowFilterDrawer(false)}
                  className="w-full py-3 bg-exam-accent hover:opacity-90 text-exam-accent-ink rounded-sm font-bold text-sm transition-opacity"
                >{filteredWords.length === 0 ? 'אין מילים שמתאימות לסינון' : `הצג ${heCount(filteredWords.length, 'word')}`}</button>
              </div>
            </div>
          </div>
        )}

        {/* ════════════════════════════════════════════════════════════════════
            FLASHCARD MODE
        ════════════════════════════════════════════════════════════════════ */}
        {mode === 'flashcard' && (
          <>
            {deck.length > 0 && (
              <div className="mb-4">
                <div className="flex justify-between text-xs text-exam-ink-soft mb-1.5">
                  <span>נותרו <span className="font-bold text-exam-ink">{deck.length}</span> מילים</span>
                  {progressScopeKnown > 0 && <span>ידעת <span className="font-bold text-exam-sage-strong">{progressScopeKnown}</span> / {progressScopeTotal} ({Math.round(progressScopeKnown / progressScopeTotal * 100)}%)</span>}
                </div>
                {progressScopeKnown > 0 && (
                  <div className="w-full bg-exam-paper-alt rounded-full h-1.5">
                    <div className="bg-exam-sage-strong h-1.5 rounded-full transition-all" style={{ width: `${Math.round(progressScopeKnown / progressScopeTotal * 100)}%` }} />
                  </div>
                )}
              </div>
            )}

            {current ? (
              <div className="relative select-none">
                {deck[2] && <div className="absolute inset-0 bg-exam-surface rounded-2xl shadow-surface border border-exam-border" style={{ transform: 'scale(0.92) translateY(18px)', zIndex: 0 }} />}
                {deck[1] && <div className="absolute inset-0 bg-exam-surface rounded-2xl shadow-surface border border-exam-border" style={{ transform: 'scale(0.96) translateY(9px)', zIndex: 1 }} />}

                <div
                  className="relative bg-exam-surface rounded-2xl shadow-raised border border-exam-border-strong p-8 min-h-[320px] flex flex-col justify-center cursor-grab active:cursor-grabbing [perspective:1200px]"
                  style={{
                    zIndex: 2,
                    transform: `translateX(${tx}px) rotate(${rotate}deg)`,
                    transition: dragX === 0 && !animating
                      ? 'transform 0.5s cubic-bezier(0.34, 1.56, 0.64, 1), box-shadow 0.3s ease'
                      : animating ? 'transform 0.3s cubic-bezier(0.22, 1, 0.36, 1)' : 'none',
                    userSelect: 'none',
                  }}
                  onMouseDown={e => onDragStart(e.clientX)}
                  onMouseMove={e => { if (dragStartX.current !== null) onDragMove(e.clientX); }}
                  onMouseUp={onDragEnd}
                  onMouseLeave={() => { if (dragStartX.current !== null) { dragStartX.current = null; setDragX(0); } }}
                  onTouchStart={e => onDragStart(e.touches[0].clientX)}
                  onTouchMove={e => onDragMove(e.touches[0].clientX)}
                  onTouchEnd={onDragEnd}
                >
                  {/* Swipe feedback: the whole card turns green/red with the
                      label written straight on the color, the way the card
                      always looked. It sits ABOVE the card content (z-20) —
                      the animated card face forms its own layer, so an
                      un-indexed overlay used to paint under the word and the
                      stars — and the face fades out twice as fast as the
                      color fades in, so nothing shows through the label. The label
                      leans toward the card edge that stays on screen. */}
                  <div className="absolute inset-0 z-20 rounded-2xl bg-exam-sage-strong flex items-center justify-center gap-2 pr-24 text-on-emerald text-3xl font-black pointer-events-none" style={{ opacity: knewOpacity }} aria-hidden>
                    <Check className="w-8 h-8" strokeWidth={3} />ידעתי!
                  </div>
                  <div className="absolute inset-0 z-20 rounded-2xl bg-exam-wrong flex items-center justify-center gap-2 pl-24 text-on-danger text-3xl font-black pointer-events-none" style={{ opacity: unknownOpacity }} aria-hidden>
                    <X className="w-8 h-8" strokeWidth={3} />לא ידעתי
                  </div>

                  {/* Favorite button */}
                  <button
                    onClick={e => toggleFavorite(current.id, e)}
                    className="absolute top-4 right-4 z-10 text-exam-wrong"
                    aria-label={favorites.has(current.id) ? 'הסר ממועדפים' : 'הוסף למועדפים'}
                    aria-pressed={favorites.has(current.id)}
                  ><Heart className="w-5 h-5" fill={favorites.has(current.id) ? 'currentColor' : 'none'} aria-hidden /></button>

                  {!flipped ? (
                    <div key="front" className="text-center animate-card-flip motion-reduce:animate-none [backface-visibility:hidden]" dir="ltr" style={{ opacity: faceOpacity }}>
                      <div className="flex items-center justify-center gap-1.5 mb-4">
                        <div className={`inline-block px-3 py-1 rounded-sm text-xs font-medium ${CATEGORY_COLORS[current.category] ?? 'bg-exam-paper-alt text-exam-ink-soft'}`}>
                          {CATEGORY_LABELS[current.category] ?? current.category}
                        </div>
                        {known.has(current.id) && (
                          <div dir="rtl" className="inline-flex items-center gap-1 px-2 py-1 rounded-sm text-[10px] font-semibold bg-exam-accent/10 text-exam-accent">
                            <RotateCcw className="w-2.5 h-2.5" aria-hidden />לחזרה
                          </div>
                        )}
                      </div>
                      <div className="flex items-center justify-center gap-3 mb-2">
                        <div className="font-serif text-5xl font-bold text-exam-ink leading-tight">{current.word}</div>
                        <button
                          onClick={e => { e.stopPropagation(); speak(current.word); }}
                          className="hover:scale-110 transition-transform text-exam-ink-soft"
                          title="הגייה"
                        ><Volume2 className="w-6 h-6" aria-hidden /></button>
                      </div>
                      <div className="mb-4 flex justify-center"><StarRow n={current.difficulty_level} size={18} /></div>

                      {showHint ? (
                        <div className="font-serif mt-4 p-3 bg-exam-alt-bg border border-exam-alt/40 rounded-sm text-sm text-exam-alt italic leading-relaxed text-left">
                          &quot;{current.example_sentence}&quot;
                        </div>
                      ) : (
                        <button
                          onClick={e => { e.stopPropagation(); setShowHint(true); }}
                          className="text-xs text-exam-alt hover:opacity-80 mt-2 inline-flex items-center gap-1"
                          dir="rtl"
                        ><Lightbulb className="w-3.5 h-3.5" aria-hidden />הצג משפט לדוגמה</button>
                      )}

                      <button
                        onClick={e => { e.stopPropagation(); setFlipped(true); }}
                        className="mt-6 w-full py-2.5 rounded-sm bg-exam-paper-alt hover:bg-exam-border/40 text-sm font-medium text-exam-ink transition-colors"
                        dir="rtl"
                      >הצג תרגום ←</button>
                    </div>
                  ) : (
                    <div key="back" className="text-center animate-card-flip motion-reduce:animate-none [backface-visibility:hidden]" dir="rtl" style={{ opacity: faceOpacity }}>
                      <div className="flex items-center justify-center gap-2 mb-1" dir="ltr">
                        <span className="font-serif text-lg font-bold text-exam-ink-soft">{current.word}</span>
                        <button onClick={e => { e.stopPropagation(); speak(current.word); }} className="text-exam-ink-soft"><Volume2 className="w-4 h-4" aria-hidden /></button>
                      </div>
                      <div className="text-3xl font-bold text-exam-accent mb-3">{current.hebrew_translation}</div>
                      <p className="text-exam-ink-soft text-sm leading-relaxed mb-4">{current.definition}</p>
                      {current.example_sentence && (
                        <div className="font-serif p-3 bg-exam-paper-alt border border-exam-border rounded-sm text-xs text-exam-ink-soft italic leading-relaxed text-left" dir="ltr">
                          &quot;{current.example_sentence}&quot;
                        </div>
                      )}
                      <button
                        onClick={e => { e.stopPropagation(); setFlipped(false); setShowHint(false); }}
                        className="mt-4 text-xs text-exam-ink-soft hover:text-exam-ink"
                      >← חזור לצד הקדמי</button>
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <div className="text-center py-16">
                {filteredWords.length > 0 && known.size > 0 ? (
                  <>
                    <PartyPopper className="w-12 h-12 mx-auto mb-4 text-exam-sage-strong" strokeWidth={1.5} aria-hidden />
                    <div className="text-xl font-bold text-exam-ink mb-2">
                      {!filterCat && !filterDiff && !search && !activePack ? 'כל הכבוד! סיימת את כל הכרטיסיות' : 'כל הכבוד! סיימת את הסט הזה'}
                    </div>
                    <p className="text-exam-ink-soft text-sm mb-6">{progressScopeKnown === 0 ? 'הפעם לא סימנת אף מילה כידועה. בסיבוב הבא זה כבר ייראה אחרת.' : `ידעת ${heCount(progressScopeKnown, 'word')}`}</p>
                    <button onClick={handleResetAll} className="px-6 py-3 bg-exam-accent text-exam-accent-ink rounded-sm font-medium hover:opacity-90 transition-opacity inline-flex items-center gap-2">
                      <RotateCcw className="w-4 h-4" aria-hidden />התחל מחדש
                    </button>
                  </>
                ) : (
                  <>
                    <Search className="w-9 h-9 mx-auto mb-3 text-exam-ink-soft" strokeWidth={1.5} aria-hidden />
                    <div className="text-exam-ink-soft">לא מצאנו מילים שמתאימות לחיפוש. נסה מילה אחרת או נקה את הסינון.</div>
                  </>
                )}
              </div>
            )}

            {current && (
              <div className="flex gap-4 mt-6 justify-center">
                <button
                  onClick={handleUnknown}
                  disabled={!!animating}
                  className="flex-1 max-w-[140px] py-4 rounded-2xl bg-exam-wrong-bg border-2 border-exam-wrong/40 text-exam-wrong font-bold text-lg shadow-surface hover:shadow-raised active:shadow-pressed hover:-translate-y-1 active:translate-y-0 active:scale-[0.95] transition-[box-shadow,transform] duration-300 ease-spring will-change-transform disabled:opacity-50 disabled:hover:translate-y-0 disabled:hover:shadow-surface"
                ><X className="mx-auto" strokeWidth={3} aria-hidden /><br /><span className="text-sm font-medium">לא ידעתי</span></button>
                <button
                  onClick={handleKnew}
                  disabled={!!animating}
                  className="flex-1 max-w-[140px] py-4 rounded-2xl bg-exam-sage-bg border-2 border-exam-sage/40 text-exam-sage-strong font-bold text-lg shadow-surface hover:shadow-raised active:shadow-pressed hover:-translate-y-1 active:translate-y-0 active:scale-[0.95] transition-[box-shadow,transform] duration-300 ease-spring will-change-transform disabled:opacity-50 disabled:hover:translate-y-0 disabled:hover:shadow-surface"
                ><Check className="mx-auto" strokeWidth={3} aria-hidden /><br /><span className="text-sm font-medium">ידעתי</span></button>
              </div>
            )}

            {current && (
              <p className="text-exam-ink-soft text-[11px] text-center mt-3">
                אפשר גם להחליק את הכרטיס: ימינה = ידעתי ✓ | שמאלה = לא ידעתי ✗
              </p>
            )}

            {knownWords.length > 0 && (
              <div className="mt-8 border-t border-exam-border pt-6">
                <button
                  onClick={() => setShowKnownList(v => !v)}
                  className="w-full flex items-center justify-between px-4 py-3 bg-exam-sage-bg border border-exam-sage/40 rounded-sm text-sm font-medium text-exam-sage-strong hover:opacity-80 transition-opacity"
                >
                  <span className="inline-flex items-center gap-1">ידעת {heCount(knownWords.length, 'word')} <Check className="inline w-3.5 h-3.5" strokeWidth={3} aria-hidden /></span>
                  <span className="inline-flex items-center gap-1">{showKnownList ? <><ChevronUp className="w-3.5 h-3.5" aria-hidden />סגור</> : <><ChevronDown className="w-3.5 h-3.5" aria-hidden />הצג</>}</span>
                </button>
                {showKnownList && (
                  <div className="mt-3 space-y-2">
                    <button onClick={handleResetAll} className="text-xs text-exam-wrong hover:opacity-80 mb-2 inline-flex items-center gap-1"><RotateCcw className="w-3 h-3" aria-hidden />אפס הכל</button>
                    {knownWords.map((w, i) => (
                      <div
                        key={w.id}
                        style={{ animationDelay: `${Math.min(i, 12) * 35}ms` }}
                        className="flex items-center justify-between px-4 py-2.5 bg-exam-surface border border-exam-border rounded-xl animate-fade-up"
                      >
                        <div dir="ltr">
                          <span className="font-semibold text-exam-ink text-sm">{w.word}</span>
                          <span className="text-exam-ink-soft text-xs mr-2"> — {w.hebrew_translation}</span>
                          {knownSchedule[w.id] && (
                            <span dir="rtl" className="text-exam-ink-soft text-[11px] block mt-0.5">{dueLabel(knownSchedule[w.id].next_review_at)}</span>
                          )}
                        </div>
                        <button
                          onClick={() => handleReturnToKnown(w.id)}
                          className="text-xs text-exam-accent hover:opacity-80 font-medium flex-shrink-0 mr-2"
                        ><RotateCcw className="inline w-3 h-3 ml-1" aria-hidden />החזר לחפיסה</button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            <div className="mt-6 text-center text-xs text-exam-ink-soft hidden sm:block">
              מקלדת: ← לא ידעתי &nbsp;|&nbsp; → ידעתי &nbsp;|&nbsp; Space להפוך &nbsp;|&nbsp; H לדוגמה
            </div>
          </>
        )}

        {/* ════════════════════════════════════════════════════════════════════
            QUIZ MODE
        ════════════════════════════════════════════════════════════════════ */}
        {mode === 'quiz' && (
          <>
            {quizDeck.length === 0 ? (
              <div className="text-center py-16">
                <Search className="w-9 h-9 mx-auto mb-3 text-exam-ink-soft" strokeWidth={1.5} aria-hidden />
                <div className="text-exam-ink-soft">לא מצאנו מילים שמתאימות לחיפוש. נסה מילה אחרת או נקה את הסינון.</div>
              </div>
            ) : quizDeck.length < 4 ? (
              /* Checks the deck actually in play, not the live filteredWords —
                 narrowing the filter mid-quiz (and canceling the resulting
                 "start a new quiz?" confirm) must not hide an otherwise-valid
                 running quiz behind this error screen. */
              <div className="text-center py-16">
                <Search className="w-9 h-9 mx-auto mb-3 text-exam-ink-soft" strokeWidth={1.5} aria-hidden />
                <div className="text-exam-ink-soft">לחידון צריך לפחות 4 מילים. הרחב את הסינון כדי להוסיף עוד.</div>
              </div>
            ) : quizDone ? (
              /* Quiz done screen */
              <div className="py-6">
                <div className="text-center mb-5">
                  <Target className="w-10 h-10 mx-auto mb-3 text-exam-accent" strokeWidth={1.5} aria-hidden />
                  <div className="text-2xl font-bold text-exam-ink mb-1">סיימת את החידון!</div>
                  <div className="text-4xl font-bold text-exam-accent mb-1">{quizScore.correct} / {quizScore.total}</div>
                  <p className="text-exam-ink-soft text-sm flex items-center justify-center gap-1.5">
                    {quizScore.correct === quizScore.total
                      ? <><Trophy className="w-4 h-4" aria-hidden />מושלם!</>
                      : quizScore.correct >= quizScore.total * 0.7
                      ? <><ThumbsUp className="w-4 h-4" aria-hidden />כל הכבוד!</>
                      : <><BookOpen className="w-4 h-4" aria-hidden />המשך להתאמן!</>}
                  </p>
                </div>

                {quizWrongWords.length > 0 && (
                  <div className="mb-5">
                    <div className="text-xs font-semibold text-exam-ink-soft mb-2 px-1 flex items-center gap-1">
                      <X className="w-3.5 h-3.5 text-exam-wrong" strokeWidth={3} aria-hidden />
                      {heCount(quizWrongWords.length, 'word')} לחזרה:
                    </div>
                    <div className="space-y-2">
                      {quizWrongWords.map(w => (
                        <div key={w.id} className="flex items-center justify-between px-4 py-2.5 bg-exam-wrong-bg border border-exam-wrong/40 rounded-sm">
                          <div>
                            <div className="font-semibold text-exam-ink text-sm" dir="ltr">{w.word}</div>
                            <div className="text-exam-ink-soft text-xs">{w.hebrew_translation}</div>
                          </div>
                          <div className="flex items-center gap-2 mr-2">
                            <button onClick={() => speak(w.word)} className="text-exam-ink-soft hover:text-exam-ink transition-colors" aria-label={`השמע הגייה של ${w.word}`}><Volume2 className="w-4 h-4" aria-hidden /></button>
                            <button
                              onClick={e => toggleFavorite(w.id, e)}
                              className={favorites.has(w.id) ? 'text-exam-wrong' : 'text-exam-ink-soft'}
                              aria-label={favorites.has(w.id) ? 'הסר ממועדפים' : 'הוסף למועדפים'}
                              aria-pressed={favorites.has(w.id)}
                            ><Heart className="w-4 h-4" fill={favorites.has(w.id) ? 'currentColor' : 'none'} aria-hidden /></button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <div className="flex gap-3">
                  <button
                    onClick={startQuiz}
                    className="flex-1 py-3 bg-exam-accent text-exam-accent-ink rounded-sm font-semibold hover:opacity-90 transition-opacity flex items-center justify-center gap-1.5"
                  ><RotateCcw className="w-4 h-4" aria-hidden />התחל מחדש</button>
                  {quizWrongWords.length > 0 && (
                    <button
                      onClick={() => {
                        setQuizDeck(quizWrongWords);
                        setQuizIndex(0);
                        setQuizScore({ correct: 0, total: 0 });
                        setQuizSelected(null);
                        setQuizCorrect(null);
                        setQuizDone(false);
                        setQuizWrongWords([]);
                        setQuizOptions(buildQuizOptions(quizWrongWords[0], quizWrongWords.length >= 4 ? quizWrongWords : filteredWords));
                      }}
                      className="flex-1 py-3 bg-exam-wrong-bg border border-exam-wrong/40 text-exam-wrong rounded-sm font-semibold hover:opacity-80 transition-opacity text-sm flex items-center justify-center gap-1.5"
                    ><X className="w-4 h-4" strokeWidth={3} aria-hidden />תרגל שגויות בלבד</button>
                  )}
                </div>
              </div>
            ) : (
              <>
                {/* Quiz progress */}
                <div className="flex items-center justify-between mb-4 text-sm text-exam-ink-soft">
                  <span>{quizIndex + 1} / {quizDeck.length}</span>
                  <span className="font-semibold text-exam-sage-strong">נכון: {quizScore.correct}</span>
                </div>
                <div className="w-full bg-exam-paper-alt rounded-sm h-1.5 mb-6 overflow-hidden">
                  <div className="bg-exam-accent h-1.5 transition-all" style={{ width: `${((quizIndex) / quizDeck.length) * 100}%` }} />
                </div>

                {/* Quiz card */}
                <div className="bg-exam-surface rounded-2xl shadow-raised border border-exam-border p-6 mb-4">
                  <div className="flex items-start justify-between mb-3">
                    <button
                      onClick={e => toggleFavorite(quizDeck[quizIndex].id, e)}
                      className={favorites.has(quizDeck[quizIndex].id) ? 'text-exam-wrong' : 'text-exam-ink-soft'}
                      aria-label={favorites.has(quizDeck[quizIndex].id) ? 'הסר ממועדפים' : 'הוסף למועדפים'}
                      aria-pressed={favorites.has(quizDeck[quizIndex].id)}
                    ><Heart className="w-5 h-5" fill={favorites.has(quizDeck[quizIndex].id) ? 'currentColor' : 'none'} aria-hidden /></button>
                    <div className="flex items-center gap-2" dir="ltr">
                      <span className="font-serif text-3xl font-bold text-exam-ink">{quizDeck[quizIndex].word}</span>
                      <button onClick={() => speak(quizDeck[quizIndex].word)} className="text-exam-ink-soft hover:text-exam-ink transition-colors"><Volume2 className="w-5 h-5" aria-hidden /></button>
                    </div>
                  </div>
                  {quizDeck[quizIndex].example_sentence && (
                    <p className="font-serif text-exam-ink-soft text-xs italic text-left" dir="ltr">
                      &quot;{quizDeck[quizIndex].example_sentence}&quot;
                    </p>
                  )}
                </div>

                {/* Options */}
                <div className="space-y-3 mb-4">
                  {quizOptions.map((opt, i) => {
                    const isCorrectOpt = opt === quizDeck[quizIndex].hebrew_translation;
                    let cls = 'w-full px-4 py-3 rounded-2xl border text-right font-medium text-sm shadow-surface transition-[background-color,border-color,box-shadow,transform] duration-300 ease-spring will-change-transform ';
                    if (quizSelected === null) {
                      cls += 'bg-exam-surface border-exam-border hover:border-exam-accent hover:bg-exam-accent/5 hover:shadow-raised hover:-translate-y-0.5 active:translate-y-0 active:scale-[0.98] active:shadow-pressed text-exam-ink';
                    } else if (isCorrectOpt) {
                      cls += 'bg-exam-sage-bg border-exam-sage-strong text-exam-sage-strong shadow-raised';
                    } else if (quizSelected === i) {
                      cls += 'bg-exam-wrong-bg border-exam-wrong text-exam-wrong shadow-pressed';
                    } else {
                      cls += 'bg-exam-surface border-exam-border text-exam-ink-soft opacity-70';
                    }
                    return (
                      <button key={i} onClick={() => handleQuizSelect(i, opt)} className={cls} disabled={quizSelected !== null}>
                        {opt}
                        {quizSelected !== null && isCorrectOpt && <Check className="inline w-3.5 h-3.5 mr-1" strokeWidth={3} aria-hidden />}
                        {quizSelected === i && !isCorrectOpt && <X className="inline w-3.5 h-3.5 mr-1" strokeWidth={3} aria-hidden />}
                      </button>
                    );
                  })}
                </div>

                {quizSelected !== null && (
                  <div className="text-center">
                    <div className={`text-lg font-bold mb-3 flex items-center justify-center gap-1.5 ${quizCorrect ? 'text-exam-sage-strong' : 'text-exam-wrong'}`}>
                      {quizCorrect ? <><Check className="w-4 h-4" strokeWidth={3} aria-hidden />נכון!</> : <><X className="w-4 h-4" strokeWidth={3} aria-hidden />לא נכון</>}
                    </div>
                    {!quizCorrect && (
                      <div className="text-sm text-exam-ink-soft mb-3">
                        התשובה הנכונה: <span className="font-bold text-exam-ink">{quizDeck[quizIndex].hebrew_translation}</span>
                      </div>
                    )}
                    <button
                      onClick={handleQuizNext}
                      className="px-8 py-3 bg-exam-accent text-exam-accent-ink rounded-2xl shadow-raised hover:shadow-overlay active:shadow-pressed hover:-translate-y-1 active:translate-y-0 active:scale-[0.97] font-semibold transition-[box-shadow,transform] duration-300 ease-spring will-change-transform flex items-center gap-1.5 mx-auto"
                    >{quizIndex + 1 >= quizDeck.length ? <><Check className="w-4 h-4" strokeWidth={3} aria-hidden />סיום</> : 'הבא ←'}</button>
                  </div>
                )}
              </>
            )}
          </>
        )}

        {/* ════════════════════════════════════════════════════════════════════
            TIMED QUIZ MODE
        ════════════════════════════════════════════════════════════════════ */}
        {mode === 'timed' && (
          <>
            {showTimedConfig ? (
              <div className="bg-exam-surface rounded-md border border-exam-border p-6">
                <div className="text-center mb-6">
                  <Clock className="w-8 h-8 mx-auto mb-2 text-exam-ink-soft" strokeWidth={1.5} aria-hidden />
                  <div className="text-xl font-bold text-exam-ink">הגדרות מבחן מהיר</div>
                </div>
                <div className="space-y-5">
                  <div>
                    <div className="text-sm font-semibold text-exam-ink-soft mb-2">מספר מילים</div>
                    <div className="flex gap-2">
                      {([5, 10, 20] as const).map(n => (
                        <button
                          key={n}
                          onClick={() => setTimedWordCount(n)}
                          className={`flex-1 py-2.5 rounded-sm border-2 font-bold text-sm transition-all ${timedWordCount === n ? 'border-exam-accent bg-exam-accent/10 text-exam-accent' : 'border-exam-border text-exam-ink-soft hover:border-exam-border-strong'}`}
                        >{n}</button>
                      ))}
                    </div>
                  </div>
                  <div>
                    <div className="text-sm font-semibold text-exam-ink-soft mb-2">זמן לכל מילה</div>
                    <div className="flex gap-2">
                      {([10, 15, 20, 30] as const).map(t => (
                        <button
                          key={t}
                          onClick={() => setTimedTimePerWord(t)}
                          className={`flex-1 py-2.5 rounded-sm border-2 font-bold text-sm transition-all ${timedTimePerWord === t ? 'border-exam-accent bg-exam-accent/10 text-exam-accent' : 'border-exam-border text-exam-ink-soft hover:border-exam-border-strong'}`}
                        >{t}ש׳</button>
                      ))}
                    </div>
                  </div>
                  <button
                    onClick={() => startTimed(timedWordCount, timedTimePerWord)}
                    disabled={filteredWords.length < 4}
                    className="w-full py-3 bg-exam-accent text-exam-accent-ink rounded-sm font-bold text-lg hover:opacity-90 transition-opacity disabled:opacity-50 flex items-center justify-center gap-1.5"
                  ><Play className="w-4 h-4" fill="currentColor" aria-hidden />התחל!</button>
                  {filteredWords.length < 4 && <p className="text-center text-xs text-exam-alt">צריך לפחות 4 מילים. הרחב את הסינון כדי להוסיף עוד.</p>}
                </div>
              </div>
            ) : timedDeck.length < 4 ? (
              /* Same fix as quiz mode above: gate on the deck actually
                 running, not the live filteredWords — otherwise narrowing
                 the filter mid-run hides the quiz behind this screen while
                 the countdown timer keeps ticking (and auto-scoring wrong
                 answers) invisibly in the background. */
              <div className="text-center py-16">
                <Search className="w-9 h-9 mx-auto mb-3 text-exam-ink-soft" strokeWidth={1.5} aria-hidden />
                <div className="text-exam-ink-soft">למבחן מהיר צריך לפחות 4 מילים. הרחב את הסינון כדי להוסיף עוד.</div>
              </div>
            ) : timedDone ? (
              /* Timed done screen */
              <div className="py-6">
                <div className="text-center mb-6">
                  <Clock className="w-10 h-10 mx-auto mb-3 text-exam-accent" strokeWidth={1.5} aria-hidden />
                  <div className="text-2xl font-bold text-exam-ink mb-1">המבחן הסתיים!</div>
                  <div className="text-5xl font-bold text-exam-accent mb-1">{timedScore}/{timedDeck.length}</div>
                  <p className="text-exam-ink-soft text-sm flex items-center justify-center gap-1.5">
                    {timedScore === timedDeck.length
                      ? <><Trophy className="w-4 h-4" aria-hidden />מושלם!</>
                      : timedScore >= timedDeck.length * 0.7
                      ? <><ThumbsUp className="w-4 h-4" aria-hidden />כל הכבוד!</>
                      : <><BookOpen className="w-4 h-4" aria-hidden />המשך להתאמן!</>}
                  </p>
                </div>

                {/* Results list */}
                <div className="space-y-2 mb-6">
                  {timedResults.map((r, i) => (
                    <div key={i} className={`flex items-center justify-between px-4 py-3 rounded-sm border ${r.correct ? 'bg-exam-sage-bg border-exam-sage/40' : 'bg-exam-wrong-bg border-exam-wrong/40'}`}>
                      <div className="text-left">
                        <div className="font-bold text-exam-ink text-sm" dir="ltr">{r.word.word}</div>
                        <div className="text-xs text-exam-ink-soft">{r.word.hebrew_translation}</div>
                        <div className="text-xs text-exam-ink-soft">{r.timeTaken.toFixed(1)}ש׳</div>
                      </div>
                      {r.correct
                        ? <Check className="w-5 h-5 text-exam-sage-strong flex-shrink-0" strokeWidth={3} aria-hidden />
                        : <X className="w-5 h-5 text-exam-wrong flex-shrink-0" strokeWidth={3} aria-hidden />}
                    </div>
                  ))}
                </div>

                {/* History */}
                {(() => {
                  const hist = loadTimedHistory().slice(-5).reverse();
                  if (hist.length < 2) return null;
                  return (
                    <div className="mb-4">
                      <div className="text-xs font-semibold text-exam-ink-soft mb-2">ניסיונות אחרונים:</div>
                      <div className="flex gap-2 flex-wrap">
                        {hist.map((h, i) => (
                          <div key={i} className={`px-3 py-1.5 rounded-sm text-xs font-medium border ${h.score / h.total >= 0.7 ? 'bg-exam-sage-bg border-exam-sage/40 text-exam-sage-strong' : 'bg-exam-wrong-bg border-exam-wrong/40 text-exam-wrong'}`}>
                            {h.score}/{h.total} <span className="text-exam-ink-soft font-normal">({h.date})</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })()}

                <div className="flex gap-3">
                  <button
                    onClick={() => startTimed(timedWordCount, timedTimePerWord)}
                    className="flex-1 py-3 bg-exam-accent text-exam-accent-ink rounded-sm font-semibold hover:opacity-90 transition-opacity text-sm flex items-center justify-center gap-1.5"
                  ><RotateCcw className="w-4 h-4" aria-hidden />שחק שוב</button>
                  <button
                    onClick={() => { setTimedDone(false); setTimedDeck([]); setShowTimedConfig(true); }}
                    className="flex-1 py-3 bg-exam-surface border border-exam-border text-exam-ink rounded-sm font-semibold hover:bg-exam-paper-alt transition-colors text-sm flex items-center justify-center gap-1.5"
                  ><Settings className="w-4 h-4" aria-hidden />הגדרות</button>
                </div>
              </div>
            ) : timedDeck.length === 0 ? (
              <div className="text-center py-16">
                <Clock className="w-9 h-9 mx-auto mb-3 text-exam-ink-soft" strokeWidth={1.5} aria-hidden />
                <div className="text-exam-ink-soft">טוען מבחן...</div>
              </div>
            ) : (
              <>
                {/* Timed progress */}
                <div className="flex items-center justify-between mb-3 text-sm text-exam-ink-soft">
                  <span>{timedIndex + 1} / {timedDeck.length}</span>
                  <span className="font-semibold text-exam-sage-strong">נכון: {timedScore}</span>
                </div>

                {/* Timer bar */}
                <div className="w-full bg-exam-paper-alt rounded-full h-3 mb-1 overflow-hidden">
                  <div
                    className={`h-3 rounded-full transition-all duration-1000 ${timerColor}`}
                    style={{ width: `${(timeLeft / timedTimePerWord) * 100}%` }}
                  />
                </div>
                <div className="text-center text-sm font-bold text-exam-ink-soft mb-5">{timeLeft}ש׳</div>

                {/* Timed card */}
                <div className="bg-exam-surface rounded-2xl shadow-raised border border-exam-border p-6 mb-4">
                  <div className="flex items-start justify-between mb-3">
                    <button
                      onClick={e => toggleFavorite(timedDeck[timedIndex].id, e)}
                      className={favorites.has(timedDeck[timedIndex].id) ? 'text-exam-wrong' : 'text-exam-ink-soft'}
                      aria-label={favorites.has(timedDeck[timedIndex].id) ? 'הסר ממועדפים' : 'הוסף למועדפים'}
                      aria-pressed={favorites.has(timedDeck[timedIndex].id)}
                    ><Heart className="w-5 h-5" fill={favorites.has(timedDeck[timedIndex].id) ? 'currentColor' : 'none'} aria-hidden /></button>
                    <div className="flex items-center gap-2" dir="ltr">
                      <span className="font-serif text-3xl font-bold text-exam-ink">{timedDeck[timedIndex].word}</span>
                      <button onClick={() => speak(timedDeck[timedIndex].word)} className="text-exam-ink-soft hover:text-exam-ink transition-colors"><Volume2 className="w-5 h-5" aria-hidden /></button>
                    </div>
                  </div>
                  {timedDeck[timedIndex].example_sentence && (
                    <p className="font-serif text-exam-ink-soft text-xs italic text-left" dir="ltr">
                      &quot;{timedDeck[timedIndex].example_sentence}&quot;
                    </p>
                  )}
                </div>

                {/* Timed options */}
                <div className="space-y-3 mb-4">
                  {timedOptions.map((opt, i) => {
                    const isCorrectOpt = opt === timedDeck[timedIndex].hebrew_translation;
                    let cls = 'w-full px-4 py-3 rounded-2xl border text-right font-medium text-sm shadow-surface transition-[background-color,border-color,box-shadow,transform] duration-300 ease-spring will-change-transform ';
                    if (timedSelected === null) {
                      cls += 'bg-exam-surface border-exam-border hover:border-exam-accent hover:bg-exam-accent/5 hover:shadow-raised hover:-translate-y-0.5 active:translate-y-0 active:scale-[0.98] active:shadow-pressed text-exam-ink';
                    } else if (isCorrectOpt) {
                      cls += 'bg-exam-sage-bg border-exam-sage-strong text-exam-sage-strong shadow-raised';
                    } else if (timedSelected === i) {
                      cls += 'bg-exam-wrong-bg border-exam-wrong text-exam-wrong shadow-pressed';
                    } else {
                      cls += 'bg-exam-surface border-exam-border text-exam-ink-soft opacity-70';
                    }
                    return (
                      <button key={i} onClick={() => handleTimedSelect(i, opt, Date.now())} className={cls} disabled={timedSelected !== null}>
                        {opt}
                        {timedSelected !== null && isCorrectOpt && <Check className="inline w-3.5 h-3.5 mr-1" strokeWidth={3} aria-hidden />}
                        {timedSelected === i && !isCorrectOpt && <X className="inline w-3.5 h-3.5 mr-1" strokeWidth={3} aria-hidden />}
                      </button>
                    );
                  })}
                </div>

                {timedSelected !== null && (
                  <div className="text-center">
                    <div className={`text-lg font-bold flex items-center justify-center gap-1.5 ${timedCorrect ? 'text-exam-sage-strong' : 'text-exam-wrong'}`}>
                      {timedSelected === -1
                        ? <><Clock className="w-4 h-4" aria-hidden />נגמר הזמן!</>
                        : timedCorrect
                        ? <><Check className="w-4 h-4" strokeWidth={3} aria-hidden />נכון!</>
                        : <><X className="w-4 h-4" strokeWidth={3} aria-hidden />לא נכון</>}
                    </div>
                  </div>
                )}
              </>
            )}
          </>
        )}
      </div>
    </div>
  );
}
