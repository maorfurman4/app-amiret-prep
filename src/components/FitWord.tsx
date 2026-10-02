'use client';

import { useLayoutEffect, useRef, useState, type CSSProperties } from 'react';

interface FitWordProps {
  text: string;
  className?: string;
  /** Largest size, used whenever the word fits (any CSS length). */
  max: string;
  /** Width taken by whatever shares the row with the word, e.g. the speaker button. */
  reserve?: string;
}

/** Above the widest Lora-bold average advance in the word bank ("momentum" ≈ 0.69em/char). */
const SAFE_EM_PER_CHAR = 0.7;

const longestRun = (text: string) => text.split(/\s+/).reduce((a, b) => (b.length > a.length ? b : a), '');

/**
 * Flashcard headword that shrinks to fit its card instead of overflowing it.
 * The `fit-word` utility sizes it in CSS against the nearest `@container`;
 * this only supplies the width of the word's longest space-free run in em,
 * measured before paint (and again once web fonts load). Until then a
 * per-character upper bound keeps the word inside the card.
 */
export function FitWord({ text, className = '', max, reserve = '0px' }: FitWordProps) {
  const ref = useRef<HTMLDivElement>(null);
  const run = longestRun(text);
  const [measured, setMeasured] = useState<{ run: string; em: number } | null>(null);

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    let cancelled = false;
    const measure = () => {
      const ctx = document.createElement('canvas').getContext('2d');
      if (cancelled || !ctx) return;
      const cs = getComputedStyle(el);
      ctx.font = `${cs.fontStyle} ${cs.fontWeight} 100px ${cs.fontFamily}`;
      // 2% slack for subpixel rounding between canvas and layout.
      setMeasured({ run, em: (ctx.measureText(run).width / 100) * 1.02 });
    };
    measure();
    document.fonts?.ready.then(measure);
    return () => { cancelled = true; };
  }, [run]);

  const em = measured?.run === run ? measured.em : run.length * SAFE_EM_PER_CHAR;
  const style = { '--fit-max': max, '--fit-reserve': reserve, '--fit-em': em } as CSSProperties;

  return <div ref={ref} lang="en" className={`fit-word ${className}`} style={style}>{text}</div>;
}
