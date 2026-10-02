import { describe, expect, it } from 'bun:test';
import { renderToStaticMarkup } from 'react-dom/server';
import { KindIcon } from '../src/shared/ui/model-tree/kind-icon';

const iconName = (html: string) => /tabler-icon-([a-z0-9-]+)/.exec(html)?.[1];

describe('KindIcon', () => {
  it.each([
    ['building_block', 'repository', 'database'],
    ['behaviour', 'Query', 'circle-letter-q'],
    ['rule', 'State change', 'status-change'],
  ] as const)('draws a %s by its pattern %s', (kind, pattern, icon) => {
    expect(
      iconName(
        renderToStaticMarkup(<KindIcon kind={kind} pattern={pattern} />),
      ),
    ).toBe(icon);
  });

  it.each([
    ['no pattern', 'building_block', null, 'blocks'],
    ['an unknown pattern', 'building_block', 'saga', 'blocks'],
    ['a property typed like a pattern', 'property', 'Event', 'point'],
  ] as const)('falls back to the kind for %s', (_, kind, pattern, icon) => {
    expect(
      iconName(
        renderToStaticMarkup(<KindIcon kind={kind} pattern={pattern} />),
      ),
    ).toBe(icon);
  });

  it.each([
    ['behaviour', 'Event', 'event'],
    ['behaviour', 'Query', 'query'],
    ['behaviour', 'Command', 'command'],
  ] as const)('tones a %s patterned %s as a %s', (kind, pattern, tone) => {
    expect(
      renderToStaticMarkup(<KindIcon kind={kind} pattern={pattern} />),
    ).toContain(`data-tone="${tone}"`);
  });

  it.each([
    ['a pattern that is no message', 'building_block', 'aggregate'],
    ['a property typed like one', 'property', 'Event'],
  ] as const)('gives no tone to %s', (_, kind, pattern) => {
    expect(
      renderToStaticMarkup(<KindIcon kind={kind} pattern={pattern} />),
    ).not.toContain('data-tone');
  });
});
