import { describe, expect, it } from 'bun:test';
import { renderToStaticMarkup } from 'react-dom/server';
import { KindIcon } from '../src/features/design-docs/ui/model-tree/kind-icon';

const iconName = (html: string) => /tabler-icon-([a-z0-9-]+)/.exec(html)?.[1];

describe('KindIcon', () => {
  it.each([
    ['building_block', 'repository', 'database'],
    ['building_block', 'query', 'circle-letter-q'],
    ['building_block', 'in_adapter', 'plug-connected'],
    ['building_block', 'out_adapter', 'plug'],
    ['building_block', 'technical_service', 'tool'],
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
    ['a property typed like a pattern', 'property', 'event', 'point'],
    [
      'a collaborator typed like a pattern',
      'collaborator',
      'repository',
      'arrows-left-right',
    ],
    ['a behavior, which has no type', 'behavior', 'Command', 'activity'],
  ] as const)('falls back to the kind for %s', (_, kind, pattern, icon) => {
    expect(
      iconName(
        renderToStaticMarkup(<KindIcon kind={kind} pattern={pattern} />),
      ),
    ).toBe(icon);
  });

  it.each([
    ['building_block', 'event', 'event'],
    ['building_block', 'query', 'query'],
    ['building_block', 'command', 'command'],
  ] as const)('tones a %s patterned %s as a %s', (kind, pattern, tone) => {
    expect(
      renderToStaticMarkup(<KindIcon kind={kind} pattern={pattern} />),
    ).toContain(`data-tone="${tone}"`);
  });

  it.each([
    ['a pattern that is no message', 'building_block', 'aggregate'],
    ['a property typed like one', 'property', 'event'],
  ] as const)('gives no tone to %s', (_, kind, pattern) => {
    expect(
      renderToStaticMarkup(<KindIcon kind={kind} pattern={pattern} />),
    ).not.toContain('data-tone');
  });
});
