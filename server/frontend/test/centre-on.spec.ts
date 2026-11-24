import { describe, expect, it } from 'bun:test';
import { centreOn, DOCK_ROOM } from '../src/shared/ui/diagram-canvas/centre-on';

/** A canvas of these cards at this zoom, recording where it was asked to centre. */
const canvasOf = (
  cards: Record<string, { x: number; y: number; hidden?: boolean }>,
  zoom = 1,
) => {
  const centred: [number, number, number | undefined][] = [];
  return {
    centred,
    flow: {
      getNode: (id: string) => cards[id],
      getNodesBounds: ([id]: string[]) => ({
        ...cards[id!]!,
        width: 100,
        height: 50,
      }),
      getZoom: () => zoom,
      setCenter: (x: number, y: number, options?: { zoom?: number }) => {
        centred.push([x, y, options?.zoom]);
        return Promise.resolve(true);
      },
    },
  };
};

describe('an element picked in the details panel, brought to the middle', () => {
  it('centres its card left of the details, at the zoom the canvas is at', () => {
    const { flow, centred } = canvasOf({ a: { x: 0, y: 0 } }, 0.5);
    centreOn(flow, ['a']);
    expect(centred).toEqual([[50 + DOCK_ROOM / 2 / 0.5, 25, 0.5]]);
  });

  it('takes the first card the canvas draws in sight, and none it does not', () => {
    const { flow, centred } = canvasOf({
      hidden: { x: 0, y: 0, hidden: true },
      hexagon: { x: 200, y: 0 },
    });
    centreOn(flow, ['missing', 'hidden', 'hexagon']);
    expect(centred.map(([x]) => x)).toEqual([250 + DOCK_ROOM / 2]);
    centreOn(flow, ['missing', 'hidden']);
    expect(centred).toHaveLength(1);
  });
});
