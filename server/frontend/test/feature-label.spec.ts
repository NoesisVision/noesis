import { describe, expect, it } from 'bun:test';
import { featureLabel } from '../src/features/dev-tools/ui/dev-tools-view';

describe('featureLabel', () => {
  it.each([
    ['lessColorsInDesignDocTree', 'Less Colors In Design Doc Tree'],
    ['compact', 'Compact'],
    ['showV2Tree', 'Show V2 Tree'],
  ])('reads %s as %s', (name, label) => {
    expect(featureLabel(name)).toBe(label);
  });
});
