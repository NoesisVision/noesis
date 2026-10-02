import { expect, it } from 'bun:test';
import {
  actualView,
  fitView,
  zoomAt,
} from '../src/shared/ui/mermaid-viewer.tsx';

const screen = { width: 1000, height: 800 };

it('fits a wide diagram to the width of the screen, centred', () => {
  const view = fitView({ width: 2000, height: 400 }, screen);

  expect(view.scale).toBeCloseTo(0.475);
  expect(view.x).toBeCloseTo(25);
  expect(view.y).toBeCloseTo(305);
});

it('enlarges a small diagram no more than twice', () => {
  expect(fitView({ width: 100, height: 50 }, screen).scale).toBe(2);
});

it('shows the diagram at the size it was drawn, centred', () => {
  expect(actualView({ width: 400, height: 200 }, screen)).toEqual({
    scale: 1,
    x: 300,
    y: 300,
  });
});

it('keeps the point under the pointer in place as it zooms', () => {
  const before = { scale: 1, x: 100, y: 50 };
  const point = { x: 300, y: 250 };
  const after = zoomAt(before, 2, point);

  // The diagram's own coordinate under the point is the same either side.
  expect((point.x - after.x) / after.scale).toBeCloseTo(
    (point.x - before.x) / before.scale,
  );
  expect((point.y - after.y) / after.scale).toBeCloseTo(
    (point.y - before.y) / before.scale,
  );
});

it('stops zooming at the limits', () => {
  const origin = { x: 0, y: 0 };
  expect(zoomAt({ scale: 6, x: 0, y: 0 }, 10, origin).scale).toBe(8);
  expect(zoomAt({ scale: 0.2, x: 0, y: 0 }, 0.01, origin).scale).toBe(0.1);
});
