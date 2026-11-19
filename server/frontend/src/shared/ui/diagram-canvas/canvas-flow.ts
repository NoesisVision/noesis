import type { FitViewOptions, ReactFlowProps } from '@xyflow/react';
import { useCallback, useMemo, useState } from 'react';
import { createStore } from '#/shared/store.ts';
import { FIT } from './fit.ts';

/*
 * What every diagram's React Flow is given alike, and its zoom: a canvas
 * reads its cards and lines, it does not connect, focus or select them the
 * way React Flow would — the canvas's own selection does that.
 */

/** The props every diagram's `ReactFlow` takes: nothing to connect, focus or select. */
export const CANVAS_FLOW = {
  nodesConnectable: false,
  nodesFocusable: false,
  edgesFocusable: false,
  elementsSelectable: false,
  attributionPosition: 'bottom-right',
} as const satisfies Partial<ReactFlowProps>;

/** What a canvas's zoom is read from and driven through. */
interface Zoomable {
  getZoom: () => number;
  zoomIn: () => Promise<boolean>;
  zoomOut: () => Promise<boolean>;
  fitView: (options?: FitViewOptions) => Promise<boolean>;
}

/**
 * A canvas's zoom: the scale it is at, read when React Flow starts and as
 * the reader moves, and the props its `ZoomControls` take. `flow` is the
 * canvas's instance, null until it starts.
 *
 * The scale is held in a store, not in the canvas's state: it changes with
 * every turn of the wheel, and only what shows it — the controls' number,
 * or a canvas that draws differently past some scale (`useStoreValue`) —
 * is drawn again for it, never the canvas round them.
 */
export function useCanvasZoom(
  flow: Zoomable | null,
  fit: FitViewOptions = FIT,
) {
  const [level] = useState(() => createStore(1));
  /** Call from `onInit`, with the instance. */
  const readZoom = useCallback(
    (instance: Pick<Zoomable, 'getZoom'>) => level.set(instance.getZoom()),
    [level],
  );
  const onMove = useCallback(
    (_: unknown, viewport: { zoom: number }) => level.set(viewport.zoom),
    [level],
  );
  // The same object while nothing it holds changes, so a view that memoises
  // what it draws round the canvas is not drawn again on every move.
  return useMemo(
    () => ({
      readZoom,
      onMove,
      /** The scale the canvas is at, to read a part of. */
      level,
      controls: {
        zoom: level,
        disabled: flow === null,
        onZoomOut: () => void flow?.zoomOut(),
        onZoomIn: () => void flow?.zoomIn(),
        onFit: () => void flow?.fitView(fit),
      },
    }),
    [readZoom, onMove, level, flow, fit],
  );
}
