import { describe, expect, it } from 'bun:test';
import { renderToStaticMarkup } from 'react-dom/server';
import { ChangeMark } from '../src/features/design-docs/ui/model-tree/change-mark';
import type { OutlineChange } from '../src/features/design-docs/ui/model-tree/model-outline';

const mark = (change: OutlineChange) =>
  renderToStaticMarkup(
    <ChangeMark change={change} color="var(--mantine-color-green-6)">
      <i>icon</i>
    </ChangeMark>,
  );

describe('ChangeMark', () => {
  it('marks each change with its own shape: a plus, a dot, an x', () => {
    const [added, modified, removed] = [
      mark('added'),
      mark('modified'),
      mark('removed'),
    ];
    expect(added).toContain('<path');
    expect(added).not.toContain('rotate');
    expect(modified).toContain('<circle');
    // The x is the plus turned a quarter of the way round.
    expect(removed).toContain('<path');
    expect(removed).toContain('rotate(45');
    for (const html of [added, modified, removed])
      expect(html.match(/<(path|circle|rect)/g)).toHaveLength(1);
  });

  it('draws the mark in the colour it is given, hidden from assistive technology', () => {
    const html = mark('modified');
    expect(html).toContain('color:var(--mantine-color-green-6)');
    expect(html).toContain('aria-hidden="true"');
  });

  it('marks nothing the design leaves alone, but keeps the icon where the others sit', () => {
    const html = mark('unchanged');
    expect(html).not.toContain('<svg');
    expect(html).toMatch(/^<span[^>]*><i>icon<\/i><\/span>$/);
  });
});
