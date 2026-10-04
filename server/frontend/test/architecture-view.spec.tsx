import { describe, expect, it } from 'bun:test';
import { renderToStaticMarkup } from 'react-dom/server';
import { DesignDocument } from '#backend/app/design-docs/design-doc.ts';
import { outlineOf } from '../src/features/design-docs/design-doc-outline';
import { ArchitectureView } from '../src/features/design-docs/ui/architecture-view';
import { MantineProvider } from '../src/shared/design-system/provider';
import { qdocArchitectureFixture } from './fixtures/design-doc-architecture.fixture';

const document = DesignDocument.parse(qdocArchitectureFixture);
const detail = { document, outline: outlineOf(document) } as never;

function render(selected: string | null = null): string {
  return renderToStaticMarkup(
    <MantineProvider>
      <ArchitectureView
        detail={detail}
        selected={selected}
        query=""
        onSelect={() => {}}
        onQuery={() => {}}
      />
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

  it('asks for a choice when nothing is in hand', () => {
    expect(page).toContain('Choose a check, a need or a card to read it.');
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
    expect(headingsOf(html)).toContainEqual([3, 'Concerns']);
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

  it('reads an element as the model does, after what the architecture finds', () => {
    const html = render(`checks/check:caller-unknown/${NOTIFY}`);
    expect(headingsOf(html)).toContainEqual([2, 'notifyUsers']);
    expect(html).toContain('Speaks in');
    expect(html).toMatch(/data-state="selected"[^>]*aria-label="notifyUsers/);
  });

  it('reads a card no row names, under a mark of its own', () => {
    const html = render(`element:in:${NOTIFY}`);
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
