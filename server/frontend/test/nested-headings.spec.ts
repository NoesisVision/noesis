import { expect, it } from 'bun:test';
import { HeadingNode } from '@lexical/rich-text';
import { createEditor, type LexicalNode } from 'lexical';
import { nestOnImport, unnestOnExport } from '../src/shared/ui/nested-headings';

/** The level a document's `#` lands on when the page heading is the `h1`. */
const UNDER_THE_PAGE = 1;

const editor = createEditor({
  nodes: [HeadingNode],
  onError: (e) => {
    throw e;
  },
});

/** The tag the import visitor builds for a `#`-count of `depth`. */
function imported(depth: number, step = UNDER_THE_PAGE): string {
  let tag = '';
  editor.update(
    () => {
      nestOnImport(step).visitNode({
        mdastNode: { type: 'heading', depth: depth as 1, children: [] },
        actions: {
          addAndStepInto: (node: LexicalNode) => {
            tag = (node as HeadingNode).getTag();
          },
        },
      } as never);
    },
    { discrete: true },
  );
  return tag;
}

/** The `#`-count the export visitor writes back for a heading shown at `tag`. */
function exported(tag: string, step = UNDER_THE_PAGE): number {
  let depth = 0;
  editor.update(
    () => {
      unnestOnExport(step).visitLexicalNode?.({
        lexicalNode: { getTag: () => tag } as HeadingNode,
        actions: {
          addAndStepInto: (_type: string, props?: Record<string, unknown>) => {
            depth = props?.depth as number;
          },
        },
      } as never);
    },
    { discrete: true },
  );
  return depth;
}

it('nests the document under the heading the page already has', () => {
  // The page's own h1 is the document title; a second one beside it would open
  // a second outline.
  expect(imported(1)).toBe('h2');
  expect(imported(2)).toBe('h3');
  expect(imported(3)).toBe('h4');
});

it('writes the levels the author wrote back to the markdown', () => {
  for (const depth of [1, 2, 3, 4, 5]) {
    expect(exported(imported(depth))).toBe(depth);
  }
});

it('stops at h6 rather than inventing a level past it', () => {
  expect(imported(6)).toBe('h6');
  expect(imported(5)).toBe('h6');
});

it('leaves the levels alone when the document is the page', () => {
  expect(imported(1, 0)).toBe('h1');
  expect(exported('h1', 0)).toBe(1);
});
