import { describe, expect, it } from 'bun:test';
import { renderToStaticMarkup } from 'react-dom/server';
import type { DesignDocumentInput } from '#backend/app/design-docs/design-doc.ts';
import { ElementPanel } from '../src/features/design-docs/ui/architecture/element-panel';
import { ChangeMarksContext } from '../src/features/design-docs/ui/element-details/change-marks-context';
import { MantineProvider } from '../src/shared/design-system/provider';
import { designDocFixture } from './fixtures/design-doc.fixture';

const REFUND = 'building_block|sales.refunds.Refund';

/** The panel over a card, for the design's own Refund, which it adds. */
const panel = (marked: boolean) =>
  renderToStaticMarkup(
    <MantineProvider>
      <ChangeMarksContext.Provider value={marked}>
        <ElementPanel
          id={REFUND}
          document={designDocFixture as DesignDocumentInput}
          eyebrow="Building Block · Aggregate"
          title="Refund"
          onSelectElement={() => {}}
          marked={marked}
        />
      </ChangeMarksContext.Provider>
    </MantineProvider>,
  );

/** The panel's header alone: what is in hand, before what it says. */
const headOf = (html: string) =>
  /<header[\s\S]*?<\/header>/.exec(html)?.[0] ?? '';

describe('the details over a card', () => {
  it('says what the design does to the element, beside what it is', () => {
    const head = headOf(panel(true));
    expect(head).toContain('Building Block · Aggregate');
    expect(head).toMatch(/mantine-Badge-root[\s\S]*added/);
  });

  it('says nothing of a change for a model read as it stands', () => {
    expect(headOf(panel(false))).not.toContain('mantine-Badge-root');
  });
});
