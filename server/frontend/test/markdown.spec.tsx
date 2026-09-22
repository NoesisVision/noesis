import { expect, it } from 'bun:test';
import type { ReactNode } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { MantineProvider } from '../src/shared/design-system/provider';
import { Markdown } from '../src/shared/ui/markdown';

const render = (markup: ReactNode) =>
  renderToStaticMarkup(<MantineProvider>{markup}</MantineProvider>);

it('renders the GitHub flavour, not just the core syntax', () => {
  const html = render(
    <Markdown>{'| slot | room |\n| --- | --- |\n| 09:00 | 2 |'}</Markdown>,
  );
  expect(html).toContain('<table>');
  expect(html).toContain('<th>slot</th>');
  expect(html).toContain('<td>09:00</td>');
});

it('replaces a mermaid fence with the diagram, never its source', () => {
  const html = render(
    <Markdown>{'```mermaid\nflowchart TD\n  A --> B\n```'}</Markdown>,
  );
  // The effect that loads mermaid has not run here, which is the state a
  // reader sees first — but the fence must already be gone.
  expect(html).not.toContain('<pre');
  expect(html).not.toContain('flowchart TD');
  expect(html).toContain('Drawing diagram');
});

it('leaves every other fence as code', () => {
  const html = render(<Markdown>{'```ts\nconst slots = 3;\n```'}</Markdown>);
  expect(html).toContain('<pre');
  expect(html).toContain('language-ts');
  expect(html).toContain('const slots = 3;');
});
