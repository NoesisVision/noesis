import { describe, expect, it } from 'bun:test';
import { selectionAfterClick } from '../src/shared/ui/diagram-canvas/canvas-selection';

describe('selectionAfterClick', () => {
  it('takes a clicked card in hand alone', () => {
    expect(selectionAfterClick(['a', 'b'], 'c', false)).toEqual(['c']);
  });

  it('lets go of a card clicked again while it is alone in hand', () => {
    expect(selectionAfterClick(['a'], 'a', false)).toEqual([]);
  });

  it('adds a card with Ctrl or Cmd, and takes it out again', () => {
    expect(selectionAfterClick(['a'], 'b', true)).toEqual(['a', 'b']);
    expect(selectionAfterClick(['a', 'b'], 'a', true)).toEqual(['b']);
  });
});
