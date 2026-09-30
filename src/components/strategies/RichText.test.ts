import { describe, expect, it } from 'vitest';
import { LATIN_RUN } from './RichText';

const runs = (text: string) => [...text.matchAll(LATIN_RUN)].map(m => m[0]);

describe('LATIN_RUN — English runs isolated inside Hebrew copy', () => {
  it('keeps a quoted English sentence together with its closing period', () => {
    expect(runs('משלו: "Although he was tired, he finished the race." זה שונה')).toEqual([
      '"Although he was tired, he finished the race."',
    ]);
  });

  it('keeps a quoted fragment that opens on punctuation in one run', () => {
    expect(runs('כשרואים "; however," יודעים')).toEqual(['"; however,"']);
  });

  it('does not swallow Hebrew punctuation that is not part of a quote', () => {
    expect(runs('אחרי נקודה-פסיק (;), ולרוב')).toEqual([]);
    expect(runs('בניגוד ל-although, אלו')).toEqual(['although']);
  });
});
