import { describe, expect, it } from 'bun:test';
import {
  documentHeadings,
  documentLinks,
  headingOfFragment,
  headingSlug,
} from '../src/features/documents/document-outline';

const DOC = `# Weather-based discount

## Goal

Grant a discount, read from [Open-Meteo](https://open-meteo.com "API").

\`\`\`
## not a heading
https://example.com/in-code
\`\`\`

### Scope **in** detail

See https://api.open-meteo.com/v1/forecast?x=1. And \`https://alone-in-code.dev\`, not \`fetch('https://in-code.dev')\`.

#### Too deep

Again [the API](https://open-meteo.com).
`;

describe('documentHeadings', () => {
  it('lists the headings down to the third level, as they read', () => {
    expect(documentHeadings(DOC)).toEqual([
      { text: 'Weather-based discount', depth: 1 },
      { text: 'Goal', depth: 2 },
      { text: 'Scope in detail', depth: 3 },
    ]);
  });
});

describe('documentLinks', () => {
  it('lists each web link once, a bare one by its host, none from code', () => {
    // An address alone in a code span counts: the page draws it as a link.
    expect(documentLinks(DOC)).toEqual([
      { label: 'Open-Meteo', href: 'https://open-meteo.com' },
      {
        label: 'api.open-meteo.com',
        href: 'https://api.open-meteo.com/v1/forecast?x=1',
      },
      { label: 'alone-in-code.dev', href: 'https://alone-in-code.dev' },
    ]);
  });
});

describe('a link to a heading of the document', () => {
  it('names it as GitHub writes its fragment', () => {
    expect(headingSlug('Glossary')).toBe('glossary');
    expect(headingSlug('Open issues used here')).toBe('open-issues-used-here');
    expect(headingSlug('FR-PRE-001: Mandatory data!')).toBe(
      'fr-pre-001-mandatory-data',
    );
  });

  it('finds the heading a fragment names, and the later ones of the same words', () => {
    const headings = [
      { text: 'Glossary', depth: 2 },
      { text: 'Notes', depth: 2 },
      { text: 'Notes', depth: 3 },
    ];
    expect(headingOfFragment(headings, '#glossary')).toBe(0);
    expect(headingOfFragment(headings, 'notes')).toBe(1);
    expect(headingOfFragment(headings, '#notes-1')).toBe(2);
    expect(headingOfFragment(headings, '#Glossary')).toBe(0);
    expect(headingOfFragment(headings, '#nowhere')).toBeNull();
  });
});
