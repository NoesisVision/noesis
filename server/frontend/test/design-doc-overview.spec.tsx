import { describe, expect, it } from 'bun:test';
import { renderToStaticMarkup } from 'react-dom/server';
import { DesignDocOverview } from '../src/features/design-docs/ui/design-doc-overview';
import { DesignDocSurface } from '../src/features/design-docs/ui/design-doc-surface';
import { MantineProvider } from '../src/shared/design-system/provider';
import { designDocDetailFixture } from './fixtures/design-doc.fixture';

const page = renderToStaticMarkup(
  <MantineProvider>
    <DesignDocSurface document={designDocDetailFixture.document}>
      <DesignDocOverview detail={designDocDetailFixture} onOpen={() => {}} />
    </DesignDocSurface>
  </MantineProvider>,
);

const headings = [...page.matchAll(/<h([1-6])[^>]*>(.*?)<\/h\1>/g)].map(
  ([, level, text]) => [Number(level), text] as const,
);

describe('DesignDocOverview', () => {
  it('heads the view a level under the design, for the outline only', () => {
    expect(headings.slice(0, 2)).toEqual([
      [1, expect.stringContaining('Partial refunds')],
      [2, 'Overview'],
    ]);
  });

  it('reads the design as a whole, with no tree beside it', () => {
    expect(page).not.toContain('role="tree"');
  });
});
