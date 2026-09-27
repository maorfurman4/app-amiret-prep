import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/auth-fetch', () => ({ authFetch: vi.fn() }));
vi.mock('@/lib/date-local', async importOriginal => ({
  ...(await importOriginal<typeof import('@/lib/date-local')>()),
  todayLocalStr: () => '2026-09-26',
}));

import { OfficialScoreForm, SavedScoreResult } from './OfficialScoreForm';

describe('OfficialScoreForm', () => {
  it('asks for test type, score and date, with a privacy note and no anchoring placeholder', () => {
    const html = renderToStaticMarkup(createElement(OfficialScoreForm, { source: 'stats', onSaved: () => {} }));
    for (const s of ['אמירנ&quot;ט', 'אמיר&quot;ם', 'פסיכומטרי', 'הציון שקיבלת', 'מתי נבחנת?', 'בחר תאריך', 'לא מוצג לאף אחד', 'placeholder="50–150"']) {
      expect(html).toContain(s);
    }
    // The date can only be within the last two years and not in the future.
    expect(html).toContain('max="2026-09-26"');
    expect(html).toContain('min="2024-09-26"'); // 730 days back, same bound as the API
  });

  it('fixes the date when editing an existing sitting', () => {
    const html = renderToStaticMarkup(createElement(OfficialScoreForm, {
      source: 'stats', onSaved: () => {}, initial: { testDate: '2026-05-01', score: 121, testType: 'amiram' },
    }));
    expect(html).toContain('1 במאי 2026');
    expect(html).not.toContain('type="date"');
    expect(html).toContain('value="121"');
    expect(html).toContain('עדכון הציון');
  });
});

describe('SavedScoreResult', () => {
  it('shows the prediction next to the real score', () => {
    const html = renderToStaticMarkup(createElement(SavedScoreResult, { saved: { score: 125, prediction: { score: 118, pExempt: 0.1 } }, onClose: () => {} }));
    expect(html).toContain('האומדן של האתר לפני המבחן');
    expect(html).toContain('>118<');
    expect(html).toContain('>125<');
  });

  it('explains when there is no prediction to compare', () => {
    const html = renderToStaticMarkup(createElement(SavedScoreResult, { saved: { score: 140, prediction: null }, onClose: () => {} }));
    expect(html).toContain('אין אומדן להשוות אליו');
    expect(html).toContain('מזל טוב על הפטור');
  });
});
