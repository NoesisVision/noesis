import { describe, expect, it } from 'bun:test';
import { renderToStaticMarkup } from 'react-dom/server';
import { WrittenBy } from '../src/features/design-docs/ui/element-details/human-mark';
import { HoverMarks } from '../src/features/design-docs/ui/unit-editor/hover-marks';
import { MantineProvider } from '../src/shared/design-system/provider';

const render = (fields: Parameters<typeof WrittenBy>[0]['fields']) =>
  renderToStaticMarkup(
    <MantineProvider>
      <WrittenBy fields={fields}>
        <span>text</span>
      </WrittenBy>
    </MantineProvider>,
  );
const human = { changed: true, value: 'x', author: 'human' } as const;
const agent = { changed: true, value: 'x', author: 'agent' } as const;

describe('WrittenBy', () => {
  it('marks text a human wrote', () => {
    expect(render([human])).toContain('data-written-by="human"');
  });

  it('is enough that one of the fields is a human’s', () => {
    expect(render([agent, undefined, human])).toContain(
      'data-written-by="human"',
    );
  });

  it('leaves alone what the agent wrote, what is left alone, and a blank', () => {
    const blank = { changed: true, value: ' ', author: 'human' } as const;
    expect(render([agent, { changed: false }, undefined, blank])).toBe(
      renderToStaticMarkup(
        <MantineProvider>
          <span>text</span>
        </MantineProvider>,
      ),
    );
  });
});

describe('the marks at the right of a text', () => {
  const marks = (props: Parameters<typeof HoverMarks>[0]) =>
    renderToStaticMarkup(
      <MantineProvider>
        <HoverMarks {...props} />
      </MantineProvider>,
    );

  it('are a pencil where it can be written, and say who wrote it where a human did', () => {
    const html = marks({ editable: true, human: true });
    expect(html).toContain('tabler-icon-pencil');
    expect(html).toContain('tabler-icon-user');
    expect(html).toContain('Written by a human');
  });

  it('are the pencil alone where the agent wrote it', () => {
    const html = marks({ editable: true });
    expect(html).toContain('tabler-icon-pencil');
    expect(html).not.toContain('Written by a human');
  });

  it('are nothing for text only read that the agent wrote', () => {
    expect(marks({})).toBe(renderToStaticMarkup(<MantineProvider />));
  });
});
