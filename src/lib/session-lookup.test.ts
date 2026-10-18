import { describe, expect, it } from 'vitest';
import { isMissingRow, loadFailure } from './session-lookup';

describe('isMissingRow', () => {
  it('treats "no row" and a malformed id as missing', () => {
    expect(isMissingRow({ code: 'PGRST116' })).toBe(true);
    expect(isMissingRow({ code: '22P02' })).toBe(true);
  });
  it('treats anything else as the database failing', () => {
    expect(isMissingRow({ code: '' })).toBe(false);
    expect(isMissingRow({})).toBe(false);
    expect(isMissingRow(null)).toBe(false);
  });
});

describe('loadFailure', () => {
  it('says "not found" for a 404, not "check your connection"', () => {
    expect(loadFailure(404)).toBe('missing');
    expect(loadFailure(429)).toBe('busy');
    expect(loadFailure(503)).toBe('failed');
    expect(loadFailure(500)).toBe('failed');
  });
});
