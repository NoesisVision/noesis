import { describe, expect, it } from 'bun:test';
import { renderToStaticMarkup } from 'react-dom/server';
import { KindIcon } from '../src/shared/ui/model-tree/kind-icon';

const iconName = (html: string) => /tabler-icon-([a-z0-9-]+)/.exec(html)?.[1];

describe('KindIcon', () => {
  it.each([
    ['building_block', 'repository', 'database'],
    ['behaviour', 'Query', 'zoom-question'],
    ['rule', 'State change', 'arrows-exchange'],
  ] as const)('draws a %s by its pattern %s', (kind, pattern, icon) => {
    expect(
      iconName(
        renderToStaticMarkup(<KindIcon kind={kind} pattern={pattern} />),
      ),
    ).toBe(icon);
  });

  it.each([
    ['no pattern', 'building_block', null, 'cube'],
    ['an unknown pattern', 'building_block', 'saga', 'cube'],
    ['a property typed like a pattern', 'property', 'Event', 'point'],
  ] as const)('falls back to the kind for %s', (_, kind, pattern, icon) => {
    expect(
      iconName(
        renderToStaticMarkup(<KindIcon kind={kind} pattern={pattern} />),
      ),
    ).toBe(icon);
  });
});
