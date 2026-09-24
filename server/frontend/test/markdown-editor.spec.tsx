import { expect, it } from 'bun:test';
import type { ReactNode } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { DocumentContent } from '../src/features/documents/ui/document-content';
import { MantineProvider } from '../src/shared/design-system/provider';
import { MarkdownEditor } from '../src/shared/ui/markdown-editor';
import {
  mermaidCodeBlock,
  NEW_DIAGRAM,
} from '../src/shared/ui/mermaid-code-block';
import { MermaidSource } from '../src/shared/ui/mermaid-fence';

const render = (markup: ReactNode) =>
  renderToStaticMarkup(<MantineProvider>{markup}</MantineProvider>);

it('takes the mermaid fence and leaves every other one to CodeMirror', () => {
  expect(mermaidCodeBlock.match('mermaid', '')).toBe(true);
  expect(mermaidCodeBlock.match('ts', '')).toBe(false);
  expect(mermaidCodeBlock.match(null, null)).toBe(false);
  // CodeMirror registers itself at 1, and would otherwise take the fence.
  expect(mermaidCodeBlock.priority).toBeGreaterThan(1);
});

it('edits the fence as source and draws it beside', () => {
  const html = render(
    <MermaidSource source={'flowchart TD\n  A --> B'} onChange={() => {}} />,
  );
  expect(html).toContain('<textarea');
  expect(html).toContain('aria-label="Mermaid diagram source"');
  expect(html).toContain('flowchart TD');
  // Mermaid loads in an effect, which has not run here; the picture is on its way.
  expect(html).toContain('Drawing diagram');
});

it('says what an empty fence is for rather than failing to draw it', () => {
  const html = render(<MermaidSource source="" onChange={() => {}} />);
  expect(html).toContain('Write a diagram to see it drawn');
  expect(html).not.toContain('Could not draw');
});

it('inserts a diagram that carries its own accessible name', () => {
  // `accTitle:` is the only text a screen reader can read in place of the
  // picture, so the fence an author starts from already has one.
  expect(NEW_DIAGRAM).toContain('accTitle:');
});

it('holds the editor back until it is opened', () => {
  const html = render(<MarkdownEditor markdown="# Hello" />);
  expect(html).toContain('Opening the editor');
});

it('heads the document page itself and opens the editor under it', () => {
  const html = render(
    <DocumentContent
      document={{
        id: '2026-09-12-payment-retry-policy',
        title: 'Payment retry policy',
        date: '2026-09-12',
        content: '# Payment retry policy\n\nRetry twice, then stop.',
      }}
    />,
  );
  expect(html).toMatch(/<h1[^>]*>Payment retry policy<\/h1>/);
  expect(html).toContain('Opening the editor');
});

it('says an empty document is empty rather than opening an editor on it', () => {
  const html = render(
    <DocumentContent
      document={{
        id: '2026-09-12-empty',
        title: 'Empty',
        date: '2026-09-12',
        content: '   ',
      }}
    />,
  );
  expect(html).toContain('This document is empty.');
  expect(html).not.toContain('Opening the editor');
});
