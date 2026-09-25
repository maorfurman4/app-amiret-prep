import { describe, expect, it } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';
import { PARTS_OF_SPEECH, partOfSpeechOf } from './part-of-speech';

describe('partOfSpeechOf', () => {
  it('prefers the part_of_speech column', () => {
    expect(partOfSpeechOf({ part_of_speech: 'adverb', category: 'connectors' })).toBe('adverb');
    expect(partOfSpeechOf({ part_of_speech: 'noun', category: 'academic' })).toBe('noun');
  });

  it('falls back to the legacy category before the backfill', () => {
    expect(partOfSpeechOf({ part_of_speech: null, category: 'verbs' })).toBe('verb');
    expect(partOfSpeechOf({ category: 'descriptive' })).toBe('adjective');
  });

  it('has no part of speech for a themed word that was not backfilled', () => {
    expect(partOfSpeechOf({ part_of_speech: null, category: 'academic' })).toBeNull();
    expect(partOfSpeechOf({ part_of_speech: 'bogus', category: 'advanced' })).toBeNull();
  });
});

describe('the reviewed backfill mapping', () => {
  const mapping = JSON.parse(readFileSync(join(process.cwd(), 'scripts', 'data', 'vocab-part-of-speech.json'), 'utf8')) as Record<string, string>;

  it('covers every word with a valid part of speech', () => {
    expect(Object.keys(mapping).length).toBe(1158);
    for (const [word, part] of Object.entries(mapping)) expect(PARTS_OF_SPEECH, word).toContain(part);
  });

  it('classifies the words the old categories got wrong or left out', () => {
    expect(mapping.primarily).toBe('adverb');       // was "connectors"
    expect(mapping.integrity).toBe('noun');         // was "descriptive"
    expect(mapping.hypothesis).toBe('noun');        // was "academic"
    expect(mapping.ubiquitous).toBe('adjective');   // was "advanced"
    expect(mapping.however).toBe('connector');
    expect(mapping.acknowledge).toBe('verb');
  });
});
