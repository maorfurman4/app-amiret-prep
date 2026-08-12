'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { createClient } from '@/lib/supabase';
import { BackNav } from '@/components/BackNav';
import { authFetch } from '@/lib/auth-fetch';

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
  adjectives:  'תואר שם',
};

const CATEGORY_COLORS: Record<string, string> = {
  general:     'bg-slate-100 text-slate-700',
  academic:    'bg-blue-100 text-blue-700',
  descriptive: 'bg-purple-100 text-purple-700',
  verbs:       'bg-green-100 text-green-700',
  connectors:  'bg-amber-100 text-amber-700',
  nouns:       'bg-rose-100 text-rose-700',
  advanced:    'bg-indigo-100 text-indigo-700',
  adjectives:  'bg-pink-100 text-pink-700',
};

const STORAGE_KEY = 'vocab_known_ids';
const FAV_KEY = 'vocab_favorites';
const TIMED_HISTORY_KEY = 'vocab_timed_history';

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

let _speakTimer: ReturnType<typeof setTimeout> | null = null;
function speak(word: string) {
  if (typeof window === 'undefined') return;
  if (_speakTimer) clearTimeout(_speakTimer);
  _speakTimer = setTimeout(() => {
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(word);
    utterance.lang = 'en-US';
    utterance.rate = 0.85;
    utterance.pitch = 1;
    window.speechSynthesis.speak(utterance);
  }, 150);
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
  const supabase = createClient();

  // Core state
  const [allWords, setAllWords] = useState<VocabWord[]>([]);
  const [loading, setLoading] = useState(true);
  const [known, setKnown] = useState<Set<string>>(new Set());
  const [favorites, setFavorites] = useState<Set<string>>(new Set());
  const [mode, setMode] = useState<Mode>('flashcard');
  const [userId, setUserId] = useState<string | null>(null);

  // Filters
  const [filterCat, setFilterCat] = useState<string>('');
  const [filterDiff, setFilterDiff] = useState<number>(0);
  const [search, setSearch] = useState('');
  const [activePack, setActivePack] = useState<string>('');

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
  const [wordStart, setWordStart] = useState(Date.now());
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const timedIndexRef = useRef(0);
  const [timedWordCount, setTimedWordCount] = useState<5 | 10 | 20>(10);
  const [timedTimePerWord, setTimedTimePerWord] = useState<10 | 15 | 20 | 30>(20);
  const [showTimedConfig, setShowTimedConfig] = useState(false);
  const [showFilterDrawer, setShowFilterDrawer] = useState(false);

  // ─── Deep link: /vocabulary?pack=connectors opens that themed pack ────────
  useEffect(() => {
    const pack = new URLSearchParams(window.location.search).get('pack');
    if (pack) setActivePack(pack);
  }, []);

  // Ensure guestId exists on first visit — other pages (exam, review-queue)
  // already do this, but a guest landing directly on /vocabulary never had
  // one generated, silently breaking the "my mistakes" pack for them.
  useEffect(() => {
    if (!localStorage.getItem('amiret_guest_id')) {
      localStorage.setItem('amiret_guest_id', crypto.randomUUID());
    }
  }, []);

  // ─── Personal pack: words from the user's own SC mistakes ─────────────────
  const [myWords, setMyWords] = useState<VocabWord[]>([]);
  useEffect(() => {
    const guestId = localStorage.getItem('amiret_guest_id') ?? '';
    authFetch(`/api/my-words?guestId=${encodeURIComponent(guestId)}`)
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
      supabase.from('user_vocab_known').select('word_id').eq('user_id', userId),
      supabase.from('user_vocab_favorites').select('word_id').eq('user_id', userId),
    ]).then(([knownRes, favRes]) => {
      if (knownRes.data) {
        const s = new Set(knownRes.data.map((r: { word_id: string }) => r.word_id));
        setKnown(s);
        saveSet(STORAGE_KEY, s);
      }
      if (favRes.data) {
        const s = new Set(favRes.data.map((r: { word_id: string }) => r.word_id));
        setFavorites(s);
        saveSet(FAV_KEY, s);
      }
    });
  }, [userId]); // eslint-disable-line react-hooks/exhaustive-deps

  // ─── Load from storage and DB ──────────────────────────────────────────────
  useEffect(() => {
    setKnown(loadSet(STORAGE_KEY));
    setFavorites(loadSet(FAV_KEY));

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
    fetchAll();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ─── Themed packs definition ───────────────────────────────────────────────
  const THEMED_PACKS = [
    ...(myWords.length > 0 ? [{ id: 'my-mistakes', label: `🔻 המילים שהפילו אותי (${myWords.length})`, filter: (w: VocabWord) => w.category === 'my-mistakes' }] : []),
    { id: 'verbs',      label: '⚡ פעלים חזקים',    filter: (w: VocabWord) => w.category === 'verbs' },
    { id: 'connectors', label: '🔗 מחברים ומעברים', filter: (w: VocabWord) => w.category === 'connectors' },
    { id: 'academic',   label: '🎓 אקדמי',           filter: (w: VocabWord) => w.category === 'academic' },
    { id: 'advanced',   label: '🔥 מתקדם',           filter: (w: VocabWord) => w.difficulty_level >= 4 },
    { id: 'easy',       label: '✅ קל להתחלה',       filter: (w: VocabWord) => w.difficulty_level <= 2 },
    { id: 'adjectives', label: '🎨 תיאורים',         filter: (w: VocabWord) => w.category === 'adjectives' || w.category === 'descriptive' },
    { id: 'nouns',      label: '📦 שמות עצם',        filter: (w: VocabWord) => w.category === 'nouns' },
    { id: 'favorites',  label: '❤️ מועדפים',         filter: (w: VocabWord) => favorites.has(w.id) },
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

  // ─── Rebuild flashcard deck on filter change ───────────────────────────────
  useEffect(() => {
    if (!allWords.length) return;
    // Always shuffle from scratch so deck order is never derived from allWords order
    const active = shuffle(filteredWords).filter(w => !known.has(w.id));
    setDeck(active);
    setFlipped(false);
    setShowHint(false);
  }, [allWords, filterCat, filterDiff, search, known, activePack, favorites]); // eslint-disable-line react-hooks/exhaustive-deps

  // ─── Build quiz options for current question ───────────────────────────────
  const buildQuizOptions = useCallback((word: VocabWord, pool: VocabWord[]): string[] => {
    const wrong = getWrongOptions(word, pool);
    const all = shuffle([word.hebrew_translation, ...wrong]);
    return all;
  }, []);

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
    setTimeLeft(timePerWord);
    setWordStart(Date.now());
    setShowTimedConfig(false);
    if (shuffled.length > 0) {
      setTimedOptions(buildQuizOptions(shuffled[0], filteredWords));
    }
  }, [filteredWords, buildQuizOptions, timedWordCount, timedTimePerWord]);

  // Sync timedIndex to ref (fix stale closure in timer)
  useEffect(() => { timedIndexRef.current = timedIndex; }, [timedIndex]);

  // Start quiz/timed when mode switches
  useEffect(() => {
    if (mode === 'quiz' && allWords.length > 0) startQuiz();
    if (mode === 'timed' && allWords.length > 0) setShowTimedConfig(true);
  }, [mode]); // eslint-disable-line react-hooks/exhaustive-deps

  // Restart quiz when filters change mid-quiz
  useEffect(() => {
    if (mode === 'quiz' && allWords.length > 0 && quizDeck.length > 0) startQuiz();
  }, [filterCat, filterDiff, search, activePack]); // eslint-disable-line react-hooks/exhaustive-deps

  // ─── Timed quiz timer ──────────────────────────────────────────────────────
  useEffect(() => {
    if (mode !== 'timed' || timedDone || timedSelected !== null) return;
    if (timedDeck.length === 0) return;

    timerRef.current = setInterval(() => {
      setTimeLeft(prev => {
        if (prev <= 1) {
          clearInterval(timerRef.current!);
          const cur = timedDeck[timedIndexRef.current];
          if (!cur) return 0;
          const elapsed = (Date.now() - wordStart) / 1000;
          const newResults = [...timedResults, { word: cur, correct: false, timeTaken: elapsed }];
          setTimedResults(newResults);
          setTimedCorrect(false);
          setTimedSelected(-1);
          setTimeout(() => advanceTimed(newResults), 1000);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [mode, timedIndex, timedDone, timedSelected, timedDeck]); // eslint-disable-line react-hooks/exhaustive-deps

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
    setTimeLeft(timedTimePerWord);
    setWordStart(Date.now());
    setTimedOptions(buildQuizOptions(timedDeck[nextIndex], filteredWords.length > 0 ? filteredWords : timedDeck));
  }, [timedDeck, filteredWords, buildQuizOptions, timedTimePerWord]);

  const handleTimedSelect = (optionIndex: number, option: string) => {
    if (timedSelected !== null || timedDone) return;
    if (timerRef.current) clearInterval(timerRef.current);

    const cur = timedDeck[timedIndex];
    const isCorrect = option === cur.hebrew_translation;
    const elapsed = (Date.now() - wordStart) / 1000;
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
      if (removing) {
        supabase.from('user_vocab_favorites').delete().eq('user_id', userId).eq('word_id', id).then();
      } else {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (supabase.from('user_vocab_favorites') as any).upsert({ user_id: userId, word_id: id }).then();
      }
    }
  };

  // ─── Flashcard handlers ────────────────────────────────────────────────────
  const current = deck[0] ?? null;

  const handleKnew = useCallback(() => {
    if (!current) return;
    const wordId = current.id;
    setAnimating('right');
    setTimeout(() => {
      const next = new Set(known);
      next.add(wordId);
      setKnown(next);
      saveSet(STORAGE_KEY, next);
      setDeck(prev => prev.slice(1));
      setFlipped(false);
      setShowHint(false);
      setDragX(0);
      setAnimating(null);
      if (userId) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (supabase.from('user_vocab_known') as any).upsert({ user_id: userId, word_id: wordId }).then();
      }
    }, 280);
  }, [current, known, userId]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleUnknown = useCallback(() => {
    if (!current) return;
    setAnimating('left');
    setTimeout(() => {
      setDeck(prev => [...prev.slice(1), prev[0]]);
      setFlipped(false);
      setShowHint(false);
      setDragX(0);
      setAnimating(null);
    }, 280);
  }, [current]);

  const handleReturnToKnown = (wordId: string) => {
    const next = new Set(known);
    next.delete(wordId);
    setKnown(next);
    saveSet(STORAGE_KEY, next);
    if (userId) {
      supabase.from('user_vocab_known').delete().eq('user_id', userId).eq('word_id', wordId).then();
    }
  };

  const handleResetAll = () => {
    setKnown(new Set());
    saveSet(STORAGE_KEY, new Set());
    setShowKnownList(false);
    if (userId) {
      supabase.from('user_vocab_known').delete().eq('user_id', userId).then();
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

  const categoryCounts = allWords.reduce<Record<string, number>>((acc, w) => { acc[w.category] = (acc[w.category] ?? 0) + 1; return acc; }, {});
  const categories = [...new Set(allWords.map(w => w.category))].filter(c => categoryCounts[c] >= 5).sort();

  // ─── Timer bar color ───────────────────────────────────────────────────────
  const timerColor = timeLeft > timedTimePerWord * 0.5 ? 'bg-green-500' : timeLeft > timedTimePerWord * 0.25 ? 'bg-yellow-500' : 'bg-red-500';

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-900 flex items-center justify-center" dir="rtl">
        <div className="text-slate-400 text-lg">טוען מילים...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-900" dir="rtl">
      <BackNav backHref="/" backLabel="דף הבית" />

      <div className="max-w-lg mx-auto px-4 pt-4 pb-32">
        <div className="flex items-center justify-between mb-4">
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">📖 אוצר מילים</h1>
          <button
            onClick={() => setShowFavoritesList(true)}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-red-50 dark:bg-red-900/25 border border-red-200 dark:border-red-800 text-red-600 dark:text-red-300 font-semibold text-sm hover:bg-red-100 dark:hover:bg-red-900/40 transition-colors"
          >
            <span>❤️</span>
            <span>מועדפים</span>
            {favorites.size > 0 && (
              <span className="bg-red-500 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center font-bold">
                {favorites.size}
              </span>
            )}
          </button>
        </div>

        {/* ── Favorites Panel ───────────────────────────────────────────────── */}
        {showFavoritesList && (
          <div className="fixed inset-0 z-50 bg-black/40 flex items-end justify-center" onClick={() => setShowFavoritesList(false)}>
            <div
              className="bg-white dark:bg-slate-800 rounded-t-3xl w-full max-w-lg max-h-[80vh] flex flex-col"
              onClick={e => e.stopPropagation()}
            >
              {/* Header */}
              <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
                <div className="flex items-center gap-2">
                  <span className="text-xl">❤️</span>
                  <span className="font-bold text-slate-900 dark:text-white text-lg">מילים שמורות</span>
                  <span className="bg-red-100 text-red-600 text-xs font-bold px-2 py-0.5 rounded-full">{favorites.size}</span>
                </div>
                <button onClick={() => setShowFavoritesList(false)} className="text-slate-400 hover:text-slate-600 text-2xl leading-none">×</button>
              </div>

              {/* Actions */}
              {favorites.size > 0 && (
                <div className="px-5 py-3 flex gap-2 border-b border-slate-100">
                  <button
                    onClick={() => {
                      setActivePack('favorites');
                      setShowFavoritesList(false);
                    }}
                    className="flex-1 py-2 bg-blue-600 text-white rounded-xl text-sm font-semibold hover:bg-blue-700 transition-colors"
                  >תרגל מועדפים בלבד ←</button>
                  <button
                    onClick={() => {
                      if (!window.confirm(`למחוק את כל ${favorites.size} המועדפים?`)) return;
                      setFavorites(new Set());
                      saveSet(FAV_KEY, new Set());
                    }}
                    className="px-3 py-2 bg-slate-100 text-slate-500 rounded-xl text-sm hover:bg-slate-200 transition-colors"
                  >נקה הכל</button>
                </div>
              )}

              {/* List */}
              <div className="overflow-y-auto flex-1 px-5 py-3">
                {favorites.size === 0 ? (
                  <div className="text-center py-12">
                    <div className="text-4xl mb-3">🤍</div>
                    <p className="text-slate-500 text-sm">עדיין לא שמרת מילים.</p>
                    <p className="text-slate-400 text-xs mt-1">לחץ ❤️ על כרטיסייה כדי לשמור אותה כאן.</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {allWords.filter(w => favorites.has(w.id)).map(w => (
                      <div key={w.id} className="flex items-center justify-between p-3 bg-slate-50 dark:bg-slate-700/50 rounded-xl border border-slate-200 dark:border-slate-600">
                        <div dir="ltr" className="flex-1 min-w-0">
                          <div className="font-bold text-slate-900 dark:text-white text-sm">{w.word}</div>
                          <div className="text-slate-500 text-xs mt-0.5">{w.hebrew_translation}</div>
                          {w.example_sentence && (
                            <div className="text-slate-400 text-xs mt-0.5 italic truncate">{w.example_sentence}</div>
                          )}
                        </div>
                        <div className="flex items-center gap-2 mr-3 flex-shrink-0">
                          <button onClick={() => speak(w.word)} className="text-lg hover:scale-110 transition-transform">🔊</button>
                          <button
                            onClick={() => {
                              const next = new Set(favorites);
                              next.delete(w.id);
                              setFavorites(next);
                              saveSet(FAV_KEY, next);
                            }}
                            className="text-red-400 hover:text-red-600 font-bold text-lg"
                          >❤️</button>
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
        <div className="flex rounded-xl bg-slate-200 dark:bg-slate-800 p-1 mb-5 gap-1">
          {([
            { id: 'flashcard', label: 'כרטיסיות' },
            { id: 'quiz',      label: 'חידון' },
            { id: 'timed',     label: 'מבחן מהיר' },
          ] as { id: Mode; label: string }[]).map(m => (
            <button
              key={m.id}
              onClick={() => setMode(m.id)}
              className={`flex-1 py-2 rounded-lg text-sm font-semibold transition-all ${mode === m.id ? 'bg-white dark:bg-slate-600 text-slate-900 dark:text-white shadow-sm' : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'}`}
            >{m.label}</button>
          ))}
        </div>

        {/* ── Filter button + active chips ──────────────────────────────────── */}
        {(() => {
          const hasActive = !!(activePack || filterCat || filterDiff || search);
          const activeCount = [activePack, filterCat, filterDiff > 0, search.trim()].filter(Boolean).length;
          return (
            <div className="mb-5">
              <div className="flex items-center gap-2 flex-wrap">
                <button
                  onClick={() => setShowFilterDrawer(true)}
                  className={`flex items-center gap-2 px-4 py-2 rounded-xl border text-sm font-semibold transition-colors ${hasActive ? 'bg-blue-600 text-white border-blue-600' : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-600 hover:border-blue-300'}`}
                >
                  🔍 סינון{activeCount > 0 ? ` (${activeCount})` : ''}
                </button>
                {activePack && (
                  <span className="flex items-center gap-1 px-2.5 py-1 bg-blue-100 text-blue-700 rounded-full text-xs font-medium">
                    {THEMED_PACKS.find(p => p.id === activePack)?.label}
                    <button onClick={() => setActivePack('')} className="hover:text-blue-900 font-bold leading-none">×</button>
                  </span>
                )}
                {filterCat && (
                  <span className="flex items-center gap-1 px-2.5 py-1 bg-slate-100 text-slate-700 rounded-full text-xs font-medium">
                    {CATEGORY_LABELS[filterCat] ?? filterCat}
                    <button onClick={() => setFilterCat('')} className="hover:text-slate-900 font-bold leading-none">×</button>
                  </span>
                )}
                {filterDiff > 0 && (
                  <span className="flex items-center gap-1 px-2.5 py-1 bg-amber-100 text-amber-700 rounded-full text-xs font-medium">
                    {'★'.repeat(filterDiff)}
                    <button onClick={() => setFilterDiff(0)} className="hover:text-amber-900 font-bold leading-none">×</button>
                  </span>
                )}
                {search.trim() && (
                  <span className="flex items-center gap-1 px-2.5 py-1 bg-green-100 text-green-700 rounded-full text-xs font-medium max-w-[140px]">
                    <span className="truncate">&ldquo;{search}&rdquo;</span>
                    <button onClick={() => setSearch('')} className="hover:text-green-900 font-bold leading-none flex-shrink-0">×</button>
                  </span>
                )}
              </div>
            </div>
          );
        })()}

        {/* ── Filter drawer ─────────────────────────────────────────────────── */}
        {showFilterDrawer && (
          <div className="fixed inset-0 z-50 bg-black/40 flex items-end justify-center" onClick={() => setShowFilterDrawer(false)}>
            <div className="bg-white dark:bg-slate-800 rounded-t-3xl w-full max-w-lg max-h-[85vh] flex flex-col" onClick={e => e.stopPropagation()}>
              <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 dark:border-slate-700">
                <span className="font-bold text-slate-900 dark:text-white text-lg">סינון מילים</span>
                <div className="flex items-center gap-4">
                  {!!(activePack || filterCat || filterDiff || search) && (
                    <button
                      onClick={() => { setActivePack(''); setFilterCat(''); setFilterDiff(0); setSearch(''); }}
                      className="text-sm text-red-500 font-semibold"
                    >נקה הכל</button>
                  )}
                  <button onClick={() => setShowFilterDrawer(false)} className="text-2xl text-slate-400 leading-none hover:text-slate-600">×</button>
                </div>
              </div>

              <div className="overflow-y-auto px-5 py-5 space-y-6">
                {/* Themed packs */}
                <div>
                  <div className="text-xs font-bold text-slate-400 uppercase tracking-wide mb-3">סטים נושאיים</div>
                  <div className="flex flex-wrap gap-2">
                    {THEMED_PACKS.map(pack => (
                      <button
                        key={pack.id}
                        onClick={() => setActivePack(activePack === pack.id ? '' : pack.id)}
                        className={`px-3 py-1.5 rounded-full text-sm font-medium border transition-all ${activePack === pack.id ? 'bg-blue-600 text-white border-blue-600' : 'bg-white dark:bg-slate-700 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-600 hover:border-blue-300'}`}
                      >{pack.label}</button>
                    ))}
                  </div>
                </div>

                {/* Categories */}
                <div>
                  <div className="text-xs font-bold text-slate-400 uppercase tracking-wide mb-3">קטגוריה</div>
                  <div className="flex flex-wrap gap-2">
                    <button onClick={() => setFilterCat('')} className={`px-3 py-1.5 rounded-full text-sm font-medium border transition-colors ${!filterCat ? 'bg-slate-800 text-white border-slate-800' : 'bg-white dark:bg-slate-700 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-600 hover:border-slate-400'}`}>הכל</button>
                    {categories.map(cat => (
                      <button key={cat} onClick={() => setFilterCat(cat === filterCat ? '' : cat)} className={`px-3 py-1.5 rounded-full text-sm font-medium border transition-colors ${filterCat === cat ? 'bg-slate-800 text-white border-slate-800' : 'bg-white dark:bg-slate-700 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-600 hover:border-slate-400'}`}>{CATEGORY_LABELS[cat] ?? cat}</button>
                    ))}
                  </div>
                </div>

                {/* Difficulty */}
                <div>
                  <div className="text-xs font-bold text-slate-400 uppercase tracking-wide mb-3">רמה</div>
                  <div className="flex gap-2 flex-wrap">
                    {[0, 1, 2, 3, 4, 5].map(d => (
                      <button key={d} onClick={() => setFilterDiff(d === filterDiff ? 0 : d)} className={`w-10 h-10 rounded-xl text-xs font-bold border transition-colors ${filterDiff === d && d !== 0 ? 'bg-slate-800 text-white border-slate-800' : d === 0 ? 'bg-white dark:bg-slate-700 text-slate-500 dark:text-slate-300 border-slate-200 dark:border-slate-600 text-[10px]' : 'bg-white dark:bg-slate-700 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-600 hover:border-slate-400'}`}>{d === 0 ? 'הכל' : '★'.repeat(d)}</button>
                    ))}
                  </div>
                </div>

                {/* Search */}
                <div>
                  <div className="text-xs font-bold text-slate-400 uppercase tracking-wide mb-3">חיפוש</div>
                  <input
                    type="text"
                    value={search}
                    onChange={e => setSearch(e.target.value)}
                    placeholder="חיפוש מילה בעברית / אנגלית..."
                    className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-600 bg-slate-50 dark:bg-slate-700 text-sm focus:outline-none focus:border-blue-400 text-right dark:text-white"
                  />
                </div>
              </div>

              <div className="px-5 py-4 border-t border-slate-100 dark:border-slate-700">
                <button
                  onClick={() => setShowFilterDrawer(false)}
                  className="w-full py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold text-sm transition-colors"
                >הצג {filteredWords.length} מילים</button>
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
                <div className="flex justify-between text-xs text-slate-500 mb-1.5">
                  <span>נותרו <span className="font-bold text-slate-700 dark:text-slate-200">{deck.length}</span> מילים</span>
                  {known.size > 0 && <span>ידעת <span className="font-bold text-green-600">{known.size}</span> / {allWords.length} ({Math.round(known.size / allWords.length * 100)}%)</span>}
                </div>
                {known.size > 0 && (
                  <div className="w-full bg-slate-200 dark:bg-slate-700 rounded-full h-1.5">
                    <div className="bg-green-500 h-1.5 rounded-full transition-all" style={{ width: `${Math.round(known.size / allWords.length * 100)}%` }} />
                  </div>
                )}
              </div>
            )}

            {current ? (
              <div className="relative select-none">
                {deck[2] && <div className="absolute inset-0 bg-white dark:bg-slate-800 rounded-3xl border border-slate-100 dark:border-slate-700 shadow-sm" style={{ transform: 'scale(0.92) translateY(18px)', zIndex: 0 }} />}
                {deck[1] && <div className="absolute inset-0 bg-white dark:bg-slate-800 rounded-3xl border border-slate-100 dark:border-slate-700 shadow-sm" style={{ transform: 'scale(0.96) translateY(9px)', zIndex: 1 }} />}

                <div
                  className="relative bg-white dark:bg-slate-800 rounded-3xl border border-slate-200 dark:border-slate-700 shadow-lg p-8 min-h-[320px] flex flex-col justify-center cursor-grab active:cursor-grabbing"
                  style={{
                    zIndex: 2,
                    transform: `translateX(${tx}px) rotate(${rotate}deg)`,
                    transition: dragX === 0 && !animating ? 'transform 0.3s ease' : animating ? 'transform 0.28s ease' : 'none',
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
                  {/* Swipe overlays */}
                  <div className="absolute inset-0 rounded-3xl bg-green-400 flex items-center justify-center text-white text-2xl font-black pointer-events-none" style={{ opacity: knewOpacity }}>✓ ידעתי!</div>
                  <div className="absolute inset-0 rounded-3xl bg-red-400 flex items-center justify-center text-white text-2xl font-black pointer-events-none" style={{ opacity: unknownOpacity }}>✗ לא ידעתי</div>

                  {/* Favorite button */}
                  <button
                    onClick={e => toggleFavorite(current.id, e)}
                    className="absolute top-4 right-4 text-xl z-10"
                    aria-label={favorites.has(current.id) ? 'הסר ממועדפים' : 'הוסף למועדפים'}
                    aria-pressed={favorites.has(current.id)}
                  >{favorites.has(current.id) ? '❤️' : '🤍'}</button>

                  {!flipped ? (
                    <div className="text-center" dir="ltr">
                      <div className={`inline-block px-3 py-1 rounded-full text-xs font-medium mb-4 ${CATEGORY_COLORS[current.category] ?? 'bg-slate-100 text-slate-600'}`}>
                        {CATEGORY_LABELS[current.category] ?? current.category}
                      </div>
                      <div className="flex items-center justify-center gap-3 mb-2">
                        <div className="text-5xl font-black text-slate-900 dark:text-white leading-tight">{current.word}</div>
                        <button
                          onClick={e => { e.stopPropagation(); speak(current.word); }}
                          className="text-2xl hover:scale-110 transition-transform"
                          title="הגייה"
                        >🔊</button>
                      </div>
                      <div className="text-amber-500 text-lg mb-4">{'★'.repeat(current.difficulty_level)}{'☆'.repeat(5 - current.difficulty_level)}</div>

                      {showHint ? (
                        <div className="mt-4 p-3 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-xl text-sm text-amber-900 dark:text-amber-200 italic leading-relaxed text-left">
                          &quot;{current.example_sentence}&quot;
                        </div>
                      ) : (
                        <button
                          onClick={e => { e.stopPropagation(); setShowHint(true); }}
                          className="text-xs text-amber-600 hover:text-amber-700 mt-2"
                          dir="rtl"
                        >💡 הצג משפט לדוגמה</button>
                      )}

                      <button
                        onClick={e => { e.stopPropagation(); setFlipped(true); }}
                        className="mt-6 w-full py-2.5 rounded-xl bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 text-sm font-medium text-slate-700 dark:text-slate-200 transition-colors"
                        dir="rtl"
                      >הצג תרגום ←</button>
                    </div>
                  ) : (
                    <div className="text-center" dir="rtl">
                      <div className="flex items-center justify-center gap-2 mb-1" dir="ltr">
                        <span className="text-lg font-bold text-slate-500">{current.word}</span>
                        <button onClick={e => { e.stopPropagation(); speak(current.word); }} className="text-lg">🔊</button>
                      </div>
                      <div className="text-3xl font-black text-blue-700 dark:text-blue-400 mb-3">{current.hebrew_translation}</div>
                      <p className="text-slate-600 dark:text-slate-300 text-sm leading-relaxed mb-4">{current.definition}</p>
                      {current.example_sentence && (
                        <div className="p-3 bg-slate-50 dark:bg-slate-700/50 border border-slate-200 dark:border-slate-600 rounded-xl text-xs text-slate-500 dark:text-slate-400 italic leading-relaxed text-left" dir="ltr">
                          &quot;{current.example_sentence}&quot;
                        </div>
                      )}
                      <button
                        onClick={e => { e.stopPropagation(); setFlipped(false); setShowHint(false); }}
                        className="mt-4 text-xs text-slate-400 hover:text-slate-600"
                      >← חזור לצד הקדמי</button>
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <div className="text-center py-16">
                {known.size > 0 && !filterCat && !filterDiff && !search && !activePack ? (
                  <>
                    <div className="text-5xl mb-4">🎉</div>
                    <div className="text-xl font-bold text-slate-800 dark:text-white mb-2">כל הכבוד! סיימת את כל הכרטיסיות</div>
                    <p className="text-slate-500 text-sm mb-6">ידעת {known.size} מילים</p>
                    <button onClick={handleResetAll} className="px-6 py-3 bg-blue-600 text-white rounded-xl font-medium hover:bg-blue-700 transition-colors">
                      התחל מחדש 🔄
                    </button>
                  </>
                ) : (
                  <>
                    <div className="text-4xl mb-3">🔍</div>
                    <div className="text-slate-500">אין מילים תואמות לחיפוש</div>
                  </>
                )}
              </div>
            )}

            {current && (
              <div className="flex gap-4 mt-6 justify-center">
                <button
                  onClick={handleUnknown}
                  disabled={!!animating}
                  className="flex-1 max-w-[140px] py-4 rounded-2xl bg-red-50 dark:bg-red-900/25 border-2 border-red-200 dark:border-red-800 text-red-600 dark:text-red-300 font-bold text-lg hover:bg-red-100 dark:hover:bg-red-900/40 active:scale-95 transition-all disabled:opacity-50"
                >✗<br /><span className="text-sm font-medium">לא ידעתי</span></button>
                <button
                  onClick={handleKnew}
                  disabled={!!animating}
                  className="flex-1 max-w-[140px] py-4 rounded-2xl bg-green-50 dark:bg-green-900/25 border-2 border-green-200 dark:border-green-800 text-green-600 dark:text-green-300 font-bold text-lg hover:bg-green-100 dark:hover:bg-green-900/40 active:scale-95 transition-all disabled:opacity-50"
                >✓<br /><span className="text-sm font-medium">ידעתי</span></button>
              </div>
            )}

            {current && (
              <p className="text-slate-400 dark:text-slate-500 text-[11px] text-center mt-3">
                אפשר גם להחליק את הכרטיס: ימינה = ידעתי ✓ | שמאלה = לא ידעתי ✗
              </p>
            )}

            {knownWords.length > 0 && (
              <div className="mt-8 border-t border-slate-200 pt-6">
                <button
                  onClick={() => setShowKnownList(v => !v)}
                  className="w-full flex items-center justify-between px-4 py-3 bg-green-50 dark:bg-green-900/25 border border-green-200 dark:border-green-800 rounded-xl text-sm font-medium text-green-800 dark:text-green-300 hover:bg-green-100 dark:hover:bg-green-900/40 transition-colors"
                >
                  <span>ידעת {knownWords.length} מילים ✓</span>
                  <span>{showKnownList ? '▲ סגור' : '▼ הצג'}</span>
                </button>
                {showKnownList && (
                  <div className="mt-3 space-y-2">
                    <button onClick={handleResetAll} className="text-xs text-red-500 hover:text-red-700 mb-2">אפס הכל ↺</button>
                    {knownWords.map(w => (
                      <div key={w.id} className="flex items-center justify-between px-4 py-2.5 bg-white border border-slate-200 rounded-xl">
                        <div dir="ltr">
                          <span className="font-semibold text-slate-800 text-sm">{w.word}</span>
                          <span className="text-slate-400 text-xs mr-2"> — {w.hebrew_translation}</span>
                        </div>
                        <button
                          onClick={() => handleReturnToKnown(w.id)}
                          className="text-xs text-blue-500 hover:text-blue-700 font-medium flex-shrink-0 mr-2"
                        >החזר לחפיסה ↺</button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            <div className="mt-6 text-center text-xs text-slate-300 hidden sm:block">
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
                <div className="text-4xl mb-3">🔍</div>
                <div className="text-slate-500">אין מילים תואמות לחיפוש</div>
              </div>
            ) : filteredWords.length < 4 ? (
              <div className="text-center py-16">
                <div className="text-4xl mb-3">🔍</div>
                <div className="text-slate-500">צריך לפחות 4 מילים בסט הנוכחי לחידון</div>
              </div>
            ) : quizDone ? (
              /* Quiz done screen */
              <div className="py-6">
                <div className="text-center mb-5">
                  <div className="text-5xl mb-3">🎯</div>
                  <div className="text-2xl font-black text-slate-900 mb-1">סיימת את החידון!</div>
                  <div className="text-4xl font-black text-blue-600 mb-1">{quizScore.correct} / {quizScore.total}</div>
                  <p className="text-slate-500 text-sm">
                    {quizScore.correct === quizScore.total ? '🏆 מושלם!' : quizScore.correct >= quizScore.total * 0.7 ? '👍 כל הכבוד!' : '💪 המשך להתאמן!'}
                  </p>
                </div>

                {quizWrongWords.length > 0 && (
                  <div className="mb-5">
                    <div className="text-xs font-semibold text-slate-400 mb-2 px-1">
                      ✗ {quizWrongWords.length} מילים לחזרה:
                    </div>
                    <div className="space-y-2">
                      {quizWrongWords.map(w => (
                        <div key={w.id} className="flex items-center justify-between px-4 py-2.5 bg-red-50 border border-red-200 rounded-xl">
                          <div>
                            <div className="font-semibold text-slate-800 text-sm" dir="ltr">{w.word}</div>
                            <div className="text-slate-500 text-xs">{w.hebrew_translation}</div>
                          </div>
                          <div className="flex items-center gap-2 mr-2">
                            <button onClick={() => speak(w.word)} className="text-base hover:scale-110 transition-transform" aria-label={`השמע הגייה של ${w.word}`}>🔊</button>
                            <button
                              onClick={e => toggleFavorite(w.id, e)}
                              className="text-base"
                              aria-label={favorites.has(w.id) ? 'הסר ממועדפים' : 'הוסף למועדפים'}
                              aria-pressed={favorites.has(w.id)}
                            >{favorites.has(w.id) ? '❤️' : '🤍'}</button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <div className="flex gap-3">
                  <button
                    onClick={startQuiz}
                    className="flex-1 py-3 bg-blue-600 text-white rounded-xl font-semibold hover:bg-blue-700 transition-colors"
                  >התחל מחדש 🔄</button>
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
                      className="flex-1 py-3 bg-red-50 border border-red-200 text-red-700 rounded-xl font-semibold hover:bg-red-100 transition-colors text-sm"
                    >תרגל שגויות בלבד ✗</button>
                  )}
                </div>
              </div>
            ) : (
              <>
                {/* Quiz progress */}
                <div className="flex items-center justify-between mb-4 text-sm text-slate-500">
                  <span>{quizIndex + 1} / {quizDeck.length}</span>
                  <span className="font-semibold text-green-600">נכון: {quizScore.correct}</span>
                </div>
                <div className="w-full bg-slate-200 rounded-full h-1.5 mb-6">
                  <div className="bg-blue-500 h-1.5 rounded-full transition-all" style={{ width: `${((quizIndex) / quizDeck.length) * 100}%` }} />
                </div>

                {/* Quiz card */}
                <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 mb-4">
                  <div className="flex items-start justify-between mb-3">
                    <button
                      onClick={e => toggleFavorite(quizDeck[quizIndex].id, e)}
                      className="text-xl"
                      aria-label={favorites.has(quizDeck[quizIndex].id) ? 'הסר ממועדפים' : 'הוסף למועדפים'}
                      aria-pressed={favorites.has(quizDeck[quizIndex].id)}
                    >{favorites.has(quizDeck[quizIndex].id) ? '❤️' : '🤍'}</button>
                    <div className="flex items-center gap-2" dir="ltr">
                      <span className="text-3xl font-black text-slate-900">{quizDeck[quizIndex].word}</span>
                      <button onClick={() => speak(quizDeck[quizIndex].word)} className="text-2xl hover:scale-110 transition-transform">🔊</button>
                    </div>
                  </div>
                  {quizDeck[quizIndex].example_sentence && (
                    <p className="text-slate-400 text-xs italic text-left" dir="ltr">
                      &quot;{quizDeck[quizIndex].example_sentence}&quot;
                    </p>
                  )}
                </div>

                {/* Options */}
                <div className="space-y-3 mb-4">
                  {quizOptions.map((opt, i) => {
                    const isCorrectOpt = opt === quizDeck[quizIndex].hebrew_translation;
                    let cls = 'w-full px-4 py-3 rounded-xl border-2 text-right font-medium text-sm transition-all ';
                    if (quizSelected === null) {
                      cls += 'bg-white border-slate-200 hover:border-blue-400 hover:bg-blue-50 text-slate-800';
                    } else if (isCorrectOpt) {
                      cls += 'bg-green-50 border-green-500 text-green-800';
                    } else if (quizSelected === i) {
                      cls += 'bg-red-50 border-red-500 text-red-800';
                    } else {
                      cls += 'bg-white border-slate-200 text-slate-400';
                    }
                    return (
                      <button key={i} onClick={() => handleQuizSelect(i, opt)} className={cls} disabled={quizSelected !== null}>
                        {opt}
                        {quizSelected !== null && isCorrectOpt && ' ✓'}
                        {quizSelected === i && !isCorrectOpt && ' ✗'}
                      </button>
                    );
                  })}
                </div>

                {quizSelected !== null && (
                  <div className="text-center">
                    <div className={`text-lg font-bold mb-3 ${quizCorrect ? 'text-green-600' : 'text-red-600'}`}>
                      {quizCorrect ? '✓ נכון!' : '✗ לא נכון'}
                    </div>
                    {!quizCorrect && (
                      <div className="text-sm text-slate-500 mb-3">
                        התשובה הנכונה: <span className="font-bold text-slate-800">{quizDeck[quizIndex].hebrew_translation}</span>
                      </div>
                    )}
                    <button
                      onClick={handleQuizNext}
                      className="px-8 py-3 bg-blue-600 text-white rounded-xl font-semibold hover:bg-blue-700 transition-colors"
                    >{quizIndex + 1 >= quizDeck.length ? 'סיום ✓' : 'הבא ←'}</button>
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
              <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
                <div className="text-center mb-6">
                  <div className="text-3xl mb-2">⏱️</div>
                  <div className="text-xl font-bold text-slate-900">הגדרות מבחן מהיר</div>
                </div>
                <div className="space-y-5">
                  <div>
                    <div className="text-sm font-semibold text-slate-600 mb-2">מספר מילים</div>
                    <div className="flex gap-2">
                      {([5, 10, 20] as const).map(n => (
                        <button
                          key={n}
                          onClick={() => setTimedWordCount(n)}
                          className={`flex-1 py-2.5 rounded-xl border-2 font-bold text-sm transition-all ${timedWordCount === n ? 'border-blue-500 bg-blue-50 text-blue-700' : 'border-slate-200 text-slate-600 hover:border-blue-300'}`}
                        >{n}</button>
                      ))}
                    </div>
                  </div>
                  <div>
                    <div className="text-sm font-semibold text-slate-600 mb-2">זמן לכל מילה</div>
                    <div className="flex gap-2">
                      {([10, 15, 20, 30] as const).map(t => (
                        <button
                          key={t}
                          onClick={() => setTimedTimePerWord(t)}
                          className={`flex-1 py-2.5 rounded-xl border-2 font-bold text-sm transition-all ${timedTimePerWord === t ? 'border-blue-500 bg-blue-50 text-blue-700' : 'border-slate-200 text-slate-600 hover:border-blue-300'}`}
                        >{t}ש׳</button>
                      ))}
                    </div>
                  </div>
                  <button
                    onClick={() => startTimed(timedWordCount, timedTimePerWord)}
                    disabled={filteredWords.length < 4}
                    className="w-full py-3 bg-blue-600 text-white rounded-xl font-bold text-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
                  >התחל! ▶</button>
                  {filteredWords.length < 4 && <p className="text-center text-xs text-red-500">צריך לפחות 4 מילים בסט הנוכחי</p>}
                </div>
              </div>
            ) : filteredWords.length < 4 ? (
              <div className="text-center py-16">
                <div className="text-4xl mb-3">🔍</div>
                <div className="text-slate-500">צריך לפחות 4 מילים למבחן מהיר</div>
              </div>
            ) : timedDone ? (
              /* Timed done screen */
              <div className="py-6">
                <div className="text-center mb-6">
                  <div className="text-5xl mb-3">⏱️</div>
                  <div className="text-2xl font-black text-slate-900 mb-1">המבחן הסתיים!</div>
                  <div className="text-5xl font-black text-blue-600 mb-1">{timedScore}/{timedDeck.length}</div>
                  <p className="text-slate-500 text-sm">
                    {timedScore === timedDeck.length ? '🏆 מושלם!' : timedScore >= timedDeck.length * 0.7 ? '👍 כל הכבוד!' : '💪 המשך להתאמן!'}
                  </p>
                </div>

                {/* Results list */}
                <div className="space-y-2 mb-6">
                  {timedResults.map((r, i) => (
                    <div key={i} className={`flex items-center justify-between px-4 py-3 rounded-xl border-2 ${r.correct ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'}`}>
                      <div className="text-left">
                        <div className="font-bold text-slate-800 text-sm" dir="ltr">{r.word.word}</div>
                        <div className="text-xs text-slate-500">{r.word.hebrew_translation}</div>
                        <div className="text-xs text-slate-400">{r.timeTaken.toFixed(1)}ש׳</div>
                      </div>
                      <span className="text-xl">{r.correct ? '✓' : '✗'}</span>
                    </div>
                  ))}
                </div>

                {/* History */}
                {(() => {
                  const hist = loadTimedHistory().slice(-5).reverse();
                  if (hist.length < 2) return null;
                  return (
                    <div className="mb-4">
                      <div className="text-xs font-semibold text-slate-400 mb-2">ניסיונות אחרונים:</div>
                      <div className="flex gap-2 flex-wrap">
                        {hist.map((h, i) => (
                          <div key={i} className={`px-3 py-1.5 rounded-lg text-xs font-medium border ${h.score / h.total >= 0.7 ? 'bg-green-50 border-green-200 text-green-700' : 'bg-red-50 border-red-200 text-red-700'}`}>
                            {h.score}/{h.total} <span className="text-slate-400 font-normal">({h.date})</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })()}

                <div className="flex gap-3">
                  <button
                    onClick={() => startTimed(timedWordCount, timedTimePerWord)}
                    className="flex-1 py-3 bg-blue-600 text-white rounded-xl font-semibold hover:bg-blue-700 transition-colors text-sm"
                  >שחק שוב 🔄</button>
                  <button
                    onClick={() => { setTimedDone(false); setTimedDeck([]); setShowTimedConfig(true); }}
                    className="flex-1 py-3 bg-slate-100 text-slate-700 rounded-xl font-semibold hover:bg-slate-200 transition-colors text-sm"
                  >הגדרות ⚙️</button>
                </div>
              </div>
            ) : timedDeck.length === 0 ? (
              <div className="text-center py-16">
                <div className="text-4xl mb-3">⏱️</div>
                <div className="text-slate-500">טוען מבחן...</div>
              </div>
            ) : (
              <>
                {/* Timed progress */}
                <div className="flex items-center justify-between mb-3 text-sm text-slate-500">
                  <span>{timedIndex + 1} / {timedDeck.length}</span>
                  <span className="font-semibold text-green-600">נכון: {timedScore}</span>
                </div>

                {/* Timer bar */}
                <div className="w-full bg-slate-200 rounded-full h-3 mb-1 overflow-hidden">
                  <div
                    className={`h-3 rounded-full transition-all duration-1000 ${timerColor}`}
                    style={{ width: `${(timeLeft / timedTimePerWord) * 100}%` }}
                  />
                </div>
                <div className="text-center text-sm font-bold text-slate-600 mb-5">{timeLeft}ש׳</div>

                {/* Timed card */}
                <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 mb-4">
                  <div className="flex items-start justify-between mb-3">
                    <button
                      onClick={e => toggleFavorite(timedDeck[timedIndex].id, e)}
                      className="text-xl"
                      aria-label={favorites.has(timedDeck[timedIndex].id) ? 'הסר ממועדפים' : 'הוסף למועדפים'}
                      aria-pressed={favorites.has(timedDeck[timedIndex].id)}
                    >{favorites.has(timedDeck[timedIndex].id) ? '❤️' : '🤍'}</button>
                    <div className="flex items-center gap-2" dir="ltr">
                      <span className="text-3xl font-black text-slate-900">{timedDeck[timedIndex].word}</span>
                      <button onClick={() => speak(timedDeck[timedIndex].word)} className="text-2xl hover:scale-110 transition-transform">🔊</button>
                    </div>
                  </div>
                  {timedDeck[timedIndex].example_sentence && (
                    <p className="text-slate-400 text-xs italic text-left" dir="ltr">
                      &quot;{timedDeck[timedIndex].example_sentence}&quot;
                    </p>
                  )}
                </div>

                {/* Timed options */}
                <div className="space-y-3 mb-4">
                  {timedOptions.map((opt, i) => {
                    const isCorrectOpt = opt === timedDeck[timedIndex].hebrew_translation;
                    let cls = 'w-full px-4 py-3 rounded-xl border-2 text-right font-medium text-sm transition-all ';
                    if (timedSelected === null) {
                      cls += 'bg-white border-slate-200 hover:border-blue-400 hover:bg-blue-50 text-slate-800';
                    } else if (isCorrectOpt) {
                      cls += 'bg-green-50 border-green-500 text-green-800';
                    } else if (timedSelected === i) {
                      cls += 'bg-red-50 border-red-500 text-red-800';
                    } else {
                      cls += 'bg-white border-slate-200 text-slate-400';
                    }
                    return (
                      <button key={i} onClick={() => handleTimedSelect(i, opt)} className={cls} disabled={timedSelected !== null}>
                        {opt}
                        {timedSelected !== null && isCorrectOpt && ' ✓'}
                        {timedSelected === i && !isCorrectOpt && ' ✗'}
                      </button>
                    );
                  })}
                </div>

                {timedSelected !== null && (
                  <div className="text-center">
                    <div className={`text-lg font-bold ${timedCorrect ? 'text-green-600' : 'text-red-600'}`}>
                      {timedSelected === -1 ? '⏰ פג הזמן!' : timedCorrect ? '✓ נכון!' : '✗ לא נכון'}
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
