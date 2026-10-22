import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

// Guards the Exam/Practice split: /exam offers only the two full-exam modes
// (the quick diagnostic and the redundant "section" mode moved to /practice).
// These are source-level checks because the pages are client components and
// the test runner is a plain node env with no DOM.
const exam = readFileSync('src/app/exam/page.tsx', 'utf8');
const practice = readFileSync('src/app/practice/page.tsx', 'utf8');

describe('exam entry points', () => {
  it('offers exactly the two full-exam modes', () => {
    expect(exam).toContain("mode: 'full'");
    expect(exam).toContain("mode: 'practice'");
    expect(exam).not.toContain("mode: 'section'");
    expect(exam).toMatch(/grid-cols-1 sm:grid-cols-2/);
  });

  it('no longer links to the diagnostic, but keeps the strategies link', () => {
    expect(exam).not.toContain('/diagnostic');
    expect(exam).toContain('/strategies');
  });
});

describe('practice entry points', () => {
  it('links to the quick diagnostic', () => {
    expect(practice).toContain('href="/diagnostic"');
  });
});
