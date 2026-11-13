import {
  IconMaximize,
  IconPlayerPause,
  IconPlayerPlay,
  IconPlayerSkipBack,
  IconPlayerTrackNext,
  IconPlayerTrackPrev,
} from '@tabler/icons-react';
import {
  Background,
  Panel,
  ReactFlow,
  type ReactFlowInstance,
  useKeyPress,
} from '@xyflow/react';
import { clsx } from 'clsx';
import { useCallback, useEffect, useId, useMemo, useState } from 'react';
import { ActionIcon } from '#/shared/design-system/action-icon.tsx';
import { Box } from '#/shared/design-system/box.tsx';
import { useComputedColorScheme } from '#/shared/design-system/color-scheme.ts';
import '@xyflow/react/dist/base.css';
import { Text } from '#/shared/design-system/text.tsx';
import { DOT_GRID } from '#/shared/ui/diagram-canvas/canvas-background.ts';
import {
  CANVAS_FLOW,
  useCanvasZoom,
} from '#/shared/ui/diagram-canvas/canvas-flow.ts';
import { useLetGoOnEscape } from '#/shared/ui/diagram-canvas/canvas-keys.ts';
import { selectionAfterClick } from '#/shared/ui/diagram-canvas/canvas-selection.ts';
import { useEvenCtrlZoom } from '#/shared/ui/diagram-canvas/use-even-ctrl-zoom.ts';
import { ZoomControls } from '#/shared/ui/zoom-controls.tsx';
import { type LineEdge, LineEdgeView } from './mermaid-canvas-edge.tsx';
import {
  type BoxNode,
  BoxNodeView,
  type FrameNode,
  FrameNodeView,
} from './mermaid-canvas-nodes.tsx';
import { type Reading, ReadingContext } from './mermaid-canvas-reading.ts';
import type { DiagramGraph } from './mermaid-graph.ts';
import type { DiagramLayout } from './mermaid-layout.ts';
import { Markers } from './mermaid-markers.tsx';
import { useWidth } from './use-canvas-width.ts';
import classes from './mermaid-canvas.module.css';

/*
 * A mermaid diagram drawn as the app's other diagrams are: its boxes cards
 * in the diagrams' shapes and tokens, its frames as the exploration's, its
 * lines in the architecture's grey. It behaves as they do: a click takes a
 * box in hand and the rest steps back, a click again or on the empty canvas
 * or Escape lets go (the frontend skill's rule for the diagrams). Inline it
 * pans on a drag and zooms on a pinch or Ctrl/Cmd and the wheel, leaving the
 * wheel to the page; full screen the wheel zooms.
 */

/** What counts as somewhere else for the canvas's keys: a menu, not the dialog it may sit in. */
const IN_A_DIALOG = ['tree', 'menu'] as const;

const NODE_TYPES = { box: BoxNodeView, frame: FrameNodeView };

/** How long a step of a playing diagram stays before the next. */
const STEP_MS = 1500;

const EDGE_TYPES = { line: LineEdgeView };

/**
 * How tall the canvas stands inline: the diagram at the scale that fits it
 * across the column (never larger than its size), within reason.
 */
const INLINE = { min: 160, max: 560 };

/** Room round the fitted diagram: a strip over it for the toolbar in its corner. */
const ROOM = { top: 60, side: 20, bottom: 24 };

/** The strip a diagram that plays keeps over it besides: its step's words. */
const CAPTION_ROOM = 40;

/** Fitted inside the room, with the caption's strip too where there is one. */
const fitOf = (top: number) =>
  ({
    padding: {
      top: `${top}px`,
      bottom: `${ROOM.bottom}px`,
      left: `${ROOM.side}px`,
      right: `${ROOM.side}px`,
    },
    maxZoom: 1,
  }) as const;

export function MermaidCanvas({
  graph,
  layout,
  name,
  fullScreen = false,
  onFullScreen,
}: {
  graph: DiagramGraph;
  layout: DiagramLayout;
  /** What the diagram is called, for a reader who cannot see it. */
  name: string;
  /** Drawn over the whole screen: the wheel zooms, and it fills its box. */
  fullScreen?: boolean;
  onFullScreen?: () => void;
}) {
  const scheme = useComputedColorScheme('light');
  const markers = `mermaid-${useId().replaceAll(':', '')}`;
  const [flow, setFlow] = useState<ReactFlowInstance | null>(null);
  // Ctrl or Cmd held: the wheel zooms an inline diagram as it does full screen.
  const ctrlHeld = useKeyPress('Control');
  const cmdHeld = useKeyPress('Meta');
  const wheelZooms = fullScreen || ctrlHeld || cmdHeld;
  const [selection, setSelection] = useState<readonly string[]>([]);
  // The step of a diagram that plays, and whether it moves on by itself.
  const steps = useMemo(() => graph.steps ?? [], [graph]);
  const [step, setStep] = useState<number | null>(null);
  const [playing, setPlaying] = useState(false);
  const stop = useCallback(() => {
    setPlaying(false);
    setStep(null);
  }, []);

  // A box clicked is taken in hand alone; clicked again, alone in hand, it is
  // let go of. With Ctrl or Cmd it joins the hand, or leaves it. A step
  // playing gives way to it.
  const onClick = useCallback((id: string, adding: boolean) => {
    setPlaying(false);
    setStep(null);
    setSelection((held) => selectionAfterClick(held, id, adding));
  }, []);
  const letGo = useCallback(() => {
    setSelection([]);
    stop();
  }, [stop]);

  // Escape lets go, as on the other diagrams. In full screen the canvas sits
  // in a dialog, so a dialog's keys are the canvas's own; a menu's are not.
  useLetGoOnEscape(selection.length > 0 || step !== null, letGo, IN_A_DIALOG);

  /*
   * Playing, the diagram moves on a step each STEP_MS, and stops on the last;
   * played again from there, it starts over. A reader who asks for less
   * motion moves it on a step at a time.
   */
  const last = steps.length - 1;
  useEffect(() => {
    if (!playing || step === null) return;
    const timer = setTimeout(() => {
      if (step < last) setStep(step + 1);
      else setPlaying(false);
    }, STEP_MS);
    return () => clearTimeout(timer);
  }, [playing, step, last]);
  const goTo = useCallback(
    (to: number) => {
      setSelection([]);
      setPlaying(false);
      setStep(Math.max(0, Math.min(last, to)));
    },
    [last],
  );
  const play = useCallback(() => {
    setSelection([]);
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      setStep((at) => (at === null || at >= last ? 0 : at + 1));
      return;
    }
    setStep((at) => (at === null || at >= last ? 0 : at));
    setPlaying(true);
  }, [last]);

  const parents = useMemo(() => {
    const of = new Map<string, string | null>();
    for (const box of graph.boxes) of.set(box.id, box.parent);
    for (const frame of graph.frames) of.set(frame.id, frame.parent);
    return of;
  }, [graph]);

  const reading = useMemo<Reading>(() => {
    // A step playing: its message between its two participants, their
    // lifelines, and the frames it is drawn in, clear of the rest.
    const played =
      step === null
        ? undefined
        : graph.lines.find((line) => line.id === steps[step]);
    if (played !== undefined) {
      const selected = new Set([played.source, played.target]);
      const lines = new Set(
        graph.lines
          .filter(
            (line) =>
              line.id === played.id ||
              (line.id.startsWith('lifeline') && selected.has(line.source)),
          )
          .map(({ id }) => id),
      );
      const at = layout.lines.find((line) => line.id === played.id)?.points[0];
      const path = new Set(
        graph.frames
          .filter(({ id }) => {
            const rect = layout.rects.get(id);
            return (
              rect !== undefined &&
              at !== undefined &&
              at.y >= rect.y &&
              at.y <= rect.y + rect.height
            );
          })
          .map(({ id }) => id),
      );
      return {
        selected,
        clear: new Set([...selected, ...path]),
        related: new Set(),
        path,
        lines,
        onClick,
      };
    }
    const selected = new Set(selection);
    if (selected.size === 0)
      return {
        selected,
        clear: null,
        related: new Set(),
        path: new Set(),
        onClick,
      };
    const related = new Set<string>();
    for (const line of graph.lines) {
      if (selected.has(line.source)) related.add(line.target);
      if (selected.has(line.target)) related.add(line.source);
    }
    for (const id of selected) related.delete(id);
    const path = new Set<string>();
    for (const id of [...selected, ...related])
      for (
        let at = parents.get(id) ?? null;
        at !== null;
        at = parents.get(at) ?? null
      )
        path.add(at);
    for (const id of selected) path.delete(id);
    return {
      selected,
      clear: new Set([...selected, ...related, ...path]),
      related,
      path,
      onClick,
    };
  }, [selection, step, steps, graph, layout, parents, onClick]);

  const nodes = useMemo<(BoxNode | FrameNode)[]>(
    () => [
      ...graph.frames.flatMap((frame): FrameNode[] => {
        const rect = layout.rects.get(frame.id);
        return rect === undefined
          ? []
          : [
              {
                id: frame.id,
                type: 'frame',
                position: { x: rect.x, y: rect.y },
                width: rect.width,
                height: rect.height,
                zIndex: rect.depth,
                data: { frame },
              },
            ];
      }),
      ...graph.boxes.flatMap((box): BoxNode[] => {
        const rect = layout.rects.get(box.id);
        return rect === undefined
          ? []
          : [
              {
                id: box.id,
                type: 'box',
                position: { x: rect.x, y: rect.y },
                width: rect.width,
                height: rect.height,
                zIndex: 100,
                data: { box },
              },
            ];
      }),
    ],
    [graph, layout],
  );

  const edges = useMemo<LineEdge[]>(() => {
    const placedOf = new Map(layout.lines.map((line) => [line.id, line]));
    return graph.lines.flatMap((line): LineEdge[] => {
      const placed = placedOf.get(line.id);
      if (placed === undefined || placed.points.length < 2) return [];
      const touches =
        reading.lines?.has(line.id) ??
        (reading.selected.has(line.source) ||
          reading.selected.has(line.target));
      const isStep = step !== null && steps[step] === line.id;
      return [
        {
          id: line.id,
          type: 'line',
          source: line.source,
          target: line.target,
          zIndex: touches ? 150 : 50,
          className: clsx(
            classes.edge,
            line.pattern === 'dotted' && classes.dotted,
            line.pattern === 'dashed' && classes.dashed,
            line.thick && classes.thick,
            isStep && classes.playing,
            reading.clear !== null &&
              (touches ? classes.highlighted : classes.faded),
          ),
          data: {
            line,
            placed,
            markers,
            tone:
              reading.clear === null
                ? undefined
                : touches
                  ? 'highlighted'
                  : 'faded',
            playing: isStep,
          },
        },
      ];
    });
  }, [graph, layout, reading, markers, step, steps]);

  // Full screen, a step drawn off the screen is brought onto it.
  useEffect(() => {
    if (!fullScreen || flow === null || step === null) return;
    const points = layout.lines.find((line) => line.id === steps[step])?.points;
    if (points === undefined || points.length === 0) return;
    const xs = points.map(({ x }) => x);
    const ys = points.map(({ y }) => y);
    const middle = {
      x: (Math.min(...xs) + Math.max(...xs)) / 2,
      y: (Math.min(...ys) + Math.max(...ys)) / 2,
    };
    const shown = flow.flowToScreenPosition(middle);
    const box = document
      .querySelector(`[aria-label="${CSS.escape(name)}"][data-full-screen]`)
      ?.getBoundingClientRect();
    if (
      box === undefined ||
      (shown.x > box.left + 40 &&
        shown.x < box.right - 40 &&
        shown.y > box.top + 80 &&
        shown.y < box.bottom - 40)
    )
      return;
    void flow.setCenter(middle.x, middle.y, {
      zoom: flow.getZoom(),
      duration: 300,
    });
  }, [fullScreen, flow, step, steps, layout, name]);

  const top = ROOM.top + (steps.length > 0 ? CAPTION_ROOM : 0);
  const fit = useMemo(() => fitOf(top), [top]);
  const zoom = useCanvasZoom(flow, fit);
  const { ref: frame, width: across } = useWidth();
  useEvenCtrlZoom(frame);
  const scale =
    across > 0
      ? Math.min(1, (across - 2 * ROOM.side) / Math.max(1, layout.width))
      : 1;
  const inlineHeight = Math.min(
    INLINE.max,
    Math.max(INLINE.min, layout.height * scale + top + ROOM.bottom),
  );
  // Fitted again as the column it sits in changes width.
  useEffect(() => {
    if (flow === null) return;
    const frame = requestAnimationFrame(() => void flow.fitView(fit));
    return () => cancelAnimationFrame(frame);
  }, [flow, inlineHeight, across, fit]);

  return (
    <ReadingContext.Provider value={reading}>
      <Box
        component="section"
        aria-label={name}
        ref={frame}
        className={classes.canvas}
        data-full-screen={fullScreen || undefined}
        style={fullScreen ? undefined : { height: inlineHeight }}
        // Space plays or pauses, the arrows step through, while the canvas
        // has the keyboard; a focused button's Space is the button's own.
        onKeyDown={(event) => {
          if (steps.length === 0) return;
          const onButton = event.target instanceof HTMLButtonElement;
          if (event.key === ' ' && !onButton) {
            event.preventDefault();
            if (playing) setPlaying(false);
            else play();
          } else if (event.key === 'ArrowRight') {
            event.preventDefault();
            goTo(step === null ? 0 : step + 1);
          } else if (event.key === 'ArrowLeft' && step !== null) {
            event.preventDefault();
            goTo(step - 1);
          }
        }}
      >
        <Markers id={markers} />
        <ReactFlow
          nodes={nodes}
          edges={edges}
          nodeTypes={NODE_TYPES}
          edgeTypes={EDGE_TYPES}
          colorMode={scheme}
          fitView
          fitViewOptions={fit}
          minZoom={0.2}
          maxZoom={3}
          nodesDraggable={false}
          {...CANVAS_FLOW}
          // Inline, the wheel scrolls the page; a pinch, or Ctrl/Cmd and the
          // wheel, zooms. Full screen, the wheel zooms.
          zoomOnScroll={wheelZooms}
          preventScrolling={wheelZooms}
          zoomOnPinch
          panOnDrag
          onPaneClick={letGo}
          onInit={(instance) => {
            setFlow(instance as unknown as ReactFlowInstance);
            zoom.readZoom(instance);
          }}
          onMove={zoom.onMove}
        >
          <Background {...DOT_GRID} />
          <Panel position="top-right" className={classes.corner}>
            <Box className={classes.toolbar}>
              {steps.length > 0 && (
                <>
                  <ActionIcon
                    variant="subtle"
                    color="gray"
                    size="lg"
                    aria-label={playing ? 'Pause' : 'Play the steps'}
                    title={playing ? 'Pause' : 'Play the steps'}
                    onClick={() => (playing ? setPlaying(false) : play())}
                  >
                    {playing ? (
                      <IconPlayerPause size={18} stroke={1.6} aria-hidden />
                    ) : (
                      <IconPlayerPlay size={18} stroke={1.6} aria-hidden />
                    )}
                  </ActionIcon>
                  {step !== null && (
                    <>
                      <ActionIcon
                        variant="subtle"
                        color="gray"
                        size="lg"
                        aria-label="Back to step 1"
                        title="Back to step 1"
                        disabled={step === 0}
                        // Playing, it plays on from the start; paused, it waits there.
                        onClick={() => setStep(0)}
                      >
                        <IconPlayerSkipBack
                          size={18}
                          stroke={1.6}
                          aria-hidden
                        />
                      </ActionIcon>
                      <ActionIcon
                        variant="subtle"
                        color="gray"
                        size="lg"
                        aria-label="Previous step"
                        title="Previous step"
                        disabled={step === 0}
                        onClick={() => goTo(step - 1)}
                      >
                        <IconPlayerTrackPrev
                          size={18}
                          stroke={1.6}
                          aria-hidden
                        />
                      </ActionIcon>
                      <ActionIcon
                        variant="subtle"
                        color="gray"
                        size="lg"
                        aria-label="Next step"
                        title="Next step"
                        disabled={step === last}
                        onClick={() => goTo(step + 1)}
                      >
                        <IconPlayerTrackNext
                          size={18}
                          stroke={1.6}
                          aria-hidden
                        />
                      </ActionIcon>
                      <Text
                        component="span"
                        size="xs"
                        className={classes.count}
                      >
                        {step + 1} / {steps.length}
                      </Text>
                    </>
                  )}
                  <span className={classes.divider} aria-hidden />
                </>
              )}
              <ZoomControls quiet {...zoom.controls} />
              {onFullScreen !== undefined && (
                <ActionIcon
                  variant="subtle"
                  color="gray"
                  size="lg"
                  aria-label="Open diagram full screen"
                  title="Open diagram full screen"
                  onClick={onFullScreen}
                >
                  <IconMaximize size={18} stroke={1.6} aria-hidden />
                </ActionIcon>
              )}
            </Box>
            {/* The step's words under the controls, said as it changes. */}
            <Box className={classes.caption} aria-live="polite">
              {step !== null &&
                (graph.lines.find((line) => line.id === steps[step])?.label ??
                  `Step ${step + 1}`)}
            </Box>
          </Panel>
        </ReactFlow>
      </Box>
    </ReadingContext.Provider>
  );
}
