import { describe, expect, it, mock } from 'bun:test';
import { renderToStaticMarkup } from 'react-dom/server';
import { DesignDocument } from '#backend/app/design-docs/design-doc.ts';
import { architectureOf } from '../src/features/design-docs/design-doc-architecture';
import { outlineOf } from '../src/features/design-docs/design-doc-outline';
import { ArchitectureDetails } from '../src/features/design-docs/ui/architecture/architecture-details';
import { ArchitectureView } from '../src/features/design-docs/ui/architecture/architecture-view';
import { DetailsPanel } from '../src/features/design-docs/ui/architecture/details-panel';
import { layoutArchitecture } from '../src/features/design-docs/ui/architecture/layout-architecture';
import { DesignDocSurface } from '../src/features/design-docs/ui/design-doc-surface';
import { outlineTree } from '../src/features/design-docs/ui/model-tree/outline-tree';
import { MantineProvider } from '../src/shared/design-system/provider';
import { qdocArchitectureFixture } from './fixtures/design-doc-architecture.fixture';

// The editor that reads markdown arrives on its own and draws its text only
// in a browser: here a description reads as its markdown, so where it lands
// can be asserted. Declared here, not only where other files declare it, so
// this file reads the same alone as in the whole suite.
void mock.module(
  '../src/features/design-docs/ui/element-details/markdown-reading.tsx',
  () => ({
    MarkdownReading: ({ markdown }: { markdown: string }) => (
      <span data-markdown>{markdown}</span>
    ),
  }),
);

const document = DesignDocument.parse(qdocArchitectureFixture);
const detail = { document, outline: outlineOf(document) } as never;

function render(selected: string | null = null): string {
  return renderToStaticMarkup(
    <MantineProvider>
      <DesignDocSurface document={document}>
        <ArchitectureView
          detail={detail}
          selected={selected}
          query=""
          onSelect={() => {}}
          onQuery={() => {}}
        />
      </DesignDocSurface>
    </MantineProvider>,
  );
}

/** What the panel on the canvas reads of an element in hand. */
function read(id: string, glance = true): string {
  const outline = architectureOf(document);
  const layout = layoutArchitecture(outline.hexagons);
  return renderToStaticMarkup(
    <MantineProvider>
      <DesignDocSurface document={document}>
        <ArchitectureDetails
          subject={{ kind: 'element', id }}
          outline={outline}
          document={document}
          modelTree={outlineTree(outlineOf(document))}
          cards={new Map(layout.nodes.map((node) => [node.id, node]))}
          onSelectElement={() => {}}
          glance={glance}
        />
      </DesignDocSurface>
    </MantineProvider>,
  );
}

const headingsOf = (html: string) =>
  [...html.matchAll(/<h([1-6])[^>]*>(.*?)<\/h\1>/g)].map(
    ([, level, text]) =>
      [Number(level), text?.replace(/<[^>]+>/g, '')] as const,
  );

const NOTIFY =
  'behavior|qdocmanagement.notifications.NotificationService.notifyUsers';

describe('ArchitectureView', () => {
  const page = render();

  it('heads the page with the document, once', () => {
    expect(headingsOf(page).filter(([level]) => level === 1)).toEqual([
      [1, 'Create a QDoc'],
    ]);
  });

  it('lists the checks and the needs at the ports in a tree', () => {
    expect(page).toContain('aria-label="Architecture outline"');
    expect(page).toContain('Type in no contract');
    expect(page).toContain('Needs at the ports');
  });

  it('reads nothing on the canvas when nothing is in hand', () => {
    expect(page).not.toContain('aria-label="Selection"');
  });

  it('draws a card for every port, named by what it is', () => {
    expect(page).toMatch(
      /aria-label="createQDoc, driving port, Command, added"/,
    );
    expect(page).toMatch(
      /aria-label="notifyUsers, driving port, Command, added, 1 note"/,
    );
    expect(page).toContain('aria-label="Another subsystem, unknown caller"');
  });

  it('reads a check under the rows, linking to what it concerns', () => {
    const html = render('checks/check:caller-unknown');
    expect(headingsOf(html)).toContainEqual([2, 'Caller unknown']);
    // In the box the model lists what a block implements in.
    expect(html).toMatch(/<dt[^>]*>.*Concerns.*<\/dt>/s);
    expect(html).toMatch(/<button[^>]*>.*notifyUsers.*<\/button>/s);
    expect(html).toContain('notifyUsers is public and names no actor');
  });

  it('outlines the cards a check concerns', () => {
    const html = render('checks/check:caller-unknown');
    expect(html).toMatch(
      /data-state="related"[^>]*aria-label="notifyUsers, driving port/,
    );
  });

  it('says so of a need no port answers', () => {
    const html = render('needs/need:ready-to-write');
    expect(html).toContain('No port answers it');
  });

  it('reads the element in hand in a panel on the canvas, outlining its card', () => {
    const html = render(`checks/check:caller-unknown/${NOTIFY}`);
    const panel = html.slice(html.indexOf('aria-label="Selection"'));
    expect(panel).toMatch(/^aria-label="Selection"/);
    expect(headingsOf(panel)).toContainEqual([2, 'notifyUsers']);
    expect(panel).toContain('Clear the selection');
    expect(html).toMatch(/data-state="selected"[^>]*aria-label="notifyUsers/);
  });

  it('reads an element in the panel as the model does, after what the architecture finds', () => {
    const html = read(NOTIFY);
    expect(headingsOf(html)).toContainEqual([2, 'notifyUsers']);
    expect(html).toContain('Has input');
    expect(html).not.toContain('Speaks in');
    expect(html).not.toContain('Clear the selection');
  });

  it('reads a flow under the block at its other end, each name a link', () => {
    const html = read(
      'building_block|qdocmanagement.preparation.DocumentNumberGenerator',
    );
    const flows = html.slice(html.indexOf('Flow inferred from types'));
    const text = flows.replace(/<[^>]*>/g, '');
    expect(text).toContain('QDocgivesDocumentNumber to create');
    expect(text).not.toContain('QDoc.create');
    for (const name of ['QDoc', 'DocumentNumber', 'create'])
      expect(flows).toMatch(new RegExp(`<button[^>]*>${name}</button>`));
  });

  it("folds a rule's description in the panel, and only there", () => {
    const TITLE = 'building_block|qdocmanagement.preparation.QDocTitle';
    const BLANK = 'a blank title cannot be created';
    const glance = read(TITLE);
    expect(glance).toMatch(/aria-expanded="false"[^>]*>Show description</);
    expect(glance).not.toContain(BLANK);
    expect(glance).toContain('data-glance="true"');
    const full = read(TITLE, false);
    expect(full).toContain(BLANK);
    expect(full).not.toContain('Show description');
  });

  it('reads a card no row names in the panel', () => {
    const html = read(`in:${NOTIFY}`);
    expect(headingsOf(html)).toContainEqual([2, 'In adapter for notifyUsers']);
    expect(html).toContain('not designed');
  });

  it('never skips a heading level on the way down', () => {
    for (const html of [
      page,
      render(`checks/check:caller-unknown/${NOTIFY}`),
    ]) {
      const headings = headingsOf(html);
      for (const [index, [level]] of headings.entries()) {
        const previous = headings[index - 1]?.[0] ?? 0;
        expect(level).toBeLessThanOrEqual(previous + 1);
      }
    }
  });
});

describe('what an element in hand is called', () => {
  it('calls a module by its hexagon', () => {
    expect(read('module|qdocmanagement.notifications')).toContain(
      '>Module · hexagon<',
    );
  });

  it('calls a behaviour no card draws a behaviour, not the ring of a card', () => {
    const html = render(
      'element:behavior|qdocmanagement.preparation.QDoc.create',
    );
    expect(html).toContain('>Behaviour<');
  });
});

describe('the details panel minimized', () => {
  const panel = (onMinimize?: () => void) =>
    renderToStaticMarkup(
      <MantineProvider>
        <DetailsPanel
          document={document}
          modelTree={outlineTree([])}
          onSelectElement={() => {}}
          onMinimize={onMinimize}
          eyebrow="Value object"
          title="Money"
        >
          <p>What Money says</p>
        </DetailsPanel>
      </MantineProvider>,
    );

  it('offers to minimize where it may be minimized, and only there', () => {
    expect(panel(() => {})).toContain('aria-label="Minimize the details"');
    expect(panel()).not.toContain('Minimize the details');
    expect(panel()).toContain('What Money says');
  });
});
