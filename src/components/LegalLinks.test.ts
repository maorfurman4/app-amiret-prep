import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, it, expect } from 'vitest';
import { LegalLinks } from './LegalLinks';
import { ContactEmailLink } from './ContactEmailLink';
import { CONTACT_EMAIL } from '@/lib/contact';

describe('small-print links', () => {
  it('LegalLinks points both terms and privacy at /privacy', () => {
    const html = renderToStaticMarkup(createElement(LegalLinks));
    expect(html.match(/href="\/privacy"/g)).toHaveLength(2);
    expect(html).toContain('תנאי שימוש');
    expect(html).toContain('מדיניות פרטיות');
  });

  it('ContactEmailLink renders the contact email as a mailto', () => {
    const html = renderToStaticMarkup(createElement(ContactEmailLink));
    expect(html).toContain(`href="mailto:${CONTACT_EMAIL}"`);
    expect(html).toContain(CONTACT_EMAIL);
  });
});
