import { describe, expect, it } from 'bun:test';
import {
  selectionAfterClick,
  selectionInBox,
} from '../src/shared/ui/diagram-canvas/canvas-selection';

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

describe('a box drawn on the canvas', () => {
  const card = (id: string, x: number, y: number, holds = false) => ({
    id,
    holds,
    rect: { x, y, width: 100, height: 50 },
  });
  const frame = {
    id: 'frame',
    holds: true,
    rect: { x: 0, y: 0, width: 400, height: 300 },
  };
  const cards = [
    frame,
    card('a', 20, 20),
    card('b', 200, 20),
    card('c', 20, 200),
  ];

  it('takes in hand each card it touches, and leaves the rest', () => {
    // Over the corner of one, the whole of another.
    const box = { x: 100, y: 10, width: 220, height: 70 };
    expect(selectionInBox(box, cards)).toEqual(['a', 'b']);
  });

  it('leaves the frame it is drawn in, and one it only crosses', () => {
    expect(
      selectionInBox({ x: 10, y: 10, width: 300, height: 100 }, cards),
    ).not.toContain('frame');
    expect(
      selectionInBox({ x: -50, y: -50, width: 200, height: 200 }, cards),
    ).toEqual(['a']);
  });

  it('takes a frame it takes in whole, with all inside it', () => {
    expect(
      selectionInBox({ x: -10, y: -10, width: 420, height: 320 }, cards),
    ).toEqual(['frame', 'a', 'b', 'c']);
  });

  it('takes nothing where nothing stands', () => {
    expect(
      selectionInBox({ x: 500, y: 500, width: 50, height: 50 }, cards),
    ).toEqual([]);
  });
});
