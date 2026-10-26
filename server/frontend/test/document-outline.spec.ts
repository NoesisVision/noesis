import { describe, expect, it } from 'bun:test';
import {
  documentHeadings,
  documentLinks,
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
