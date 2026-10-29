import {
  IconDatabase,
  IconMaximize,
  IconPlayerPause,
  IconPlayerPlay,
  IconPlayerTrackNext,
  IconPlayerTrackPrev,
  IconUser,
} from '@tabler/icons-react';
import '@xyflow/react/dist/base.css';
import {
  Background,
  BackgroundVariant,
  BaseEdge,
  type Edge,
  type EdgeProps,
  EdgeLabelRenderer,
  Handle,
  type Node,
  type NodeProps,
  Panel,
  Position,
  ReactFlow,
  type ReactFlowInstance,
} from '@xyflow/react';
import { clsx } from 'clsx';
import {
  type CSSProperties,
  type MouseEvent,
  type ReactNode,
  createContext,
  useCallback,
  useContext,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
} from 'react';
import { ActionIcon } from '#/shared/design-system/action-icon.tsx';
import { Box } from '#/shared/design-system/box.tsx';
import { useComputedColorScheme } from '#/shared/design-system/color-scheme.ts';
import { Text } from '#/shared/design-system/text.tsx';
import { UnstyledButton } from '#/shared/design-system/unstyled-button.tsx';
import { cardShapeClass } from '#/shared/ui/diagram-shapes.tsx';
import { ZoomControls } from '#/shared/ui/zoom-controls.tsx';
import type {
  DiagramBox,
  DiagramFrame,
  DiagramGraph,
  DiagramLine,
  LineEnd,
} from './mermaid-graph.ts';
import type {
  DiagramLayout,
  PlacedLine,
  Point,
  Rect,
} from './mermaid-layout.ts';
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

type BoxNode = Node<{ box: DiagramBox }, 'box'>;
type FrameNode = Node<{ frame: DiagramFrame }, 'frame'>;
type LineEdge = Edge<
  {
    line: DiagramLine;
    placed: PlacedLine;
    markers: string;
    /** Where it stands to what is in hand; nothing with nothing in hand. */
    tone: 'highlighted' | 'faded' | undefined;
    /** The step being played, its dashes running along it. */
    playing: boolean;
  },
  'line'
>;

interface Reading {
  selected: ReadonlySet<string>;
  /** What stays clear while something is in hand; none with nothing in hand. */
  clear: ReadonlySet<string> | null;
  related: ReadonlySet<string>;
  path: ReadonlySet<string>;
  /** The lines drawn over the rest while a step plays; none otherwise. */
  lines?: ReadonlySet<string>;
  onClick: (id: string, adding: boolean) => void;
}

const ReadingContext = createContext<Reading>({
  selected: new Set(),
  clear: null,
  related: new Set(),
  path: new Set(),
  onClick: () => {},
});

function useBoxState(id: string) {
  const { selected, clear, related, path, onClick } =
    useContext(ReadingContext);
  return {
    state: selected.has(id)
      ? ('selected' as const)
      : path.has(id)
        ? ('path' as const)
        : related.has(id)
          ? ('related' as const)
          : undefined,
    dimmed: clear !== null && !clear.has(id),
    onClick,
  };
}

/** Where a line meets a box: React Flow needs a handle there to draw it. */
const Handles = () => (
  <>
    <Handle type="target" position={Position.Top} className={classes.handle} />
    <Handle
      type="source"
      position={Position.Bottom}
      className={classes.handle}
    />
  </>
);

const pressed = (event: { ctrlKey: boolean; metaKey: boolean }) =>
  event.ctrlKey || event.metaKey;

function BoxNodeView({
  data: { box },
  width = 0,
  height = 0,
}: NodeProps<BoxNode>) {
  const { state, dimmed, onClick } = useBoxState(box.id);
  const name = box.lines.join(' ') || box.id;
  const common = {
    'data-state': state,
    'data-dimmed': dimmed || undefined,
    'data-box': box.shape,
    'aria-pressed': state === 'selected',
    onClick: (event: MouseEvent) => onClick(box.id, pressed(event)),
  };
  const words = box.lines.map((line, index) => (
    // A line has no identity but its place in the label.
    // oxlint-disable-next-line react/no-array-index-key
    <span key={index} className={classes.line}>
      {line}
    </span>
  ));
  let body: ReactNode;
  switch (box.shape) {
    // Where a sequence diagram's lifeline ends: nothing to see or click.
    case 'point':
      return <Handles />;
    case 'start':
    case 'end':
      body = (
        <UnstyledButton
          {...common}
          className={classes.dot}
          aria-label={box.shape === 'start' ? 'Start' : 'End'}
        />
      );
      break;
    case 'bar':
      body = (
        <UnstyledButton
          {...common}
          className={classes.bar}
          aria-label="Fork or join"
        />
      );
      break;
    case 'diamond':
      body = (
        <UnstyledButton
          {...common}
          className={classes.diamond}
          aria-label={name}
        >
          <svg
            className={classes.diamondShape}
            width={width}
            height={height}
            viewBox={`0 0 ${width} ${height}`}
            aria-hidden
          >
            <polygon
              points={`${width / 2},1 ${width - 1},${height / 2} ${width / 2},${height - 1} 1,${height / 2}`}
            />
          </svg>
          <span className={classes.words}>{words}</span>
        </UnstyledButton>
      );
      break;
    case 'class':
      body = (
        <UnstyledButton
          {...common}
          className={clsx(classes.card, classes.table, cardShapeClass)}
          data-shape="box"
          aria-label={`${name}, class`}
        >
          <span className={classes.tableHead}>
            {box.annotations.map((note) => (
              <span key={note} className={classes.annotation}>
                «{note}»
              </span>
            ))}
            <span className={classes.line}>{name}</span>
          </span>
          {box.members.length > 0 && (
            <span className={classes.rows}>
              {box.members.map((member, index) => (
                // oxlint-disable-next-line react/no-array-index-key
                <span key={index} className={classes.row}>
                  {member}
                </span>
              ))}
            </span>
          )}
          {box.methods.length > 0 && (
            <span className={classes.rows}>
              {box.methods.map((method, index) => (
                // oxlint-disable-next-line react/no-array-index-key
                <span key={index} className={classes.row}>
                  {method}
                </span>
              ))}
            </span>
          )}
        </UnstyledButton>
      );
      break;
    case 'entity':
      body = (
        <UnstyledButton
          {...common}
          className={clsx(classes.card, classes.table, cardShapeClass)}
          data-shape="box"
          aria-label={`${name}, entity`}
        >
          <span className={classes.tableHead}>
            <span className={classes.line}>{name}</span>
          </span>
          {box.attributes.length > 0 && (
            <span className={clsx(classes.rows, classes.attributes)}>
              {box.attributes.map((attribute, index) => (
                // oxlint-disable-next-line react/no-array-index-key
                <span key={index} className={classes.attribute}>
                  <span className={classes.type}>{attribute.type}</span>
                  <span>{attribute.name}</span>
                  <span className={classes.keys}>
                    {attribute.keys.join(', ')}
                  </span>
                </span>
              ))}
            </span>
          )}
        </UnstyledButton>
      );
      break;
    default:
      body = (
        <UnstyledButton
          {...common}
          className={clsx(
            classes.card,
            box.shape !== 'circle' && box.shape !== 'note' && cardShapeClass,
          )}
          data-shape={box.shape === 'pill' ? 'pill' : 'box'}
          aria-label={name}
        >
          {box.shape === 'actor' && (
            <IconUser
              size={16}
              stroke={1.7}
              aria-hidden
              className={classes.icon}
            />
          )}
          {box.shape === 'database' && (
            <IconDatabase
              size={16}
              stroke={1.7}
              aria-hidden
              className={classes.icon}
            />
          )}
          <span className={classes.words}>{words}</span>
        </UnstyledButton>
      );
  }
  return (
    <>
      <Handles />
      {body}
    </>
  );
}

function FrameNodeView({ data: { frame } }: NodeProps<FrameNode>) {
  const { state, dimmed, onClick } = useBoxState(frame.id);
  return (
    <Box
      className={classes.frame}
      data-state={state}
      data-dimmed={dimmed || undefined}
      // The frame's room is the pointer's alone; its title is the
      // keyboard's way to the same.
      onClick={(event) => {
        if (event.target === event.currentTarget)
          onClick(frame.id, pressed(event));
      }}
    >
      <Handles />
      <UnstyledButton
        className={classes.frameTitle}
        aria-pressed={state === 'selected'}
        onClick={(event) => onClick(frame.id, pressed(event))}
      >
        {frame.title || frame.id}
      </UnstyledButton>
    </Box>
  );
}

/** A line along its route, its corners rounded as the exploration's are. */
function pathThrough(points: Point[], radius = 6): string {
  if (points.length === 0) return '';
  const [first, ...rest] = points;
  let path = `M ${first!.x} ${first!.y}`;
  for (let index = 0; index < rest.length; index++) {
    const at = rest[index]!;
    const next = rest[index + 1];
    const from = points[index]!;
    if (next === undefined) {
      path += ` L ${at.x} ${at.y}`;
      break;
    }
    const into = Math.hypot(at.x - from.x, at.y - from.y);
    const out = Math.hypot(next.x - at.x, next.y - at.y);
    const r = Math.min(radius, into / 2, out / 2);
    const before = {
      x: at.x - ((at.x - from.x) / into) * r,
      y: at.y - ((at.y - from.y) / into) * r,
    };
    const after = {
      x: at.x + ((next.x - at.x) / out) * r,
      y: at.y + ((next.y - at.y) / out) * r,
    };
    path += ` L ${before.x} ${before.y} Q ${at.x} ${at.y} ${after.x} ${after.y}`;
  }
  return path;
}

const labelStyle = (rect: Rect): CSSProperties => ({
  transform: `translate(${rect.x}px, ${rect.y}px)`,
  width: rect.width,
  height: rect.height,
});

function LineEdgeView({ data }: EdgeProps<LineEdge>) {
  if (data === undefined) return null;
  const { line, placed, markers } = data;
  const className = data.tone === undefined ? undefined : classes[data.tone];
  const tone = data.tone === 'highlighted' ? 'h' : 'n';
  const marker = (end: LineEnd) =>
    end === 'none' ? undefined : `url(#${markers}-${end}-${tone})`;
  return (
    <>
      <BaseEdge
        path={pathThrough(placed.points)}
        markerStart={marker(line.sourceEnd)}
        markerEnd={marker(line.targetEnd)}
      />
      <EdgeLabelRenderer>
        {[
          [line.label, placed.label, classes.label],
          [line.sourceLabel, placed.sourceLabel, classes.endLabel],
          [line.targetLabel, placed.targetLabel, classes.endLabel],
        ].map(([text, rect, kind], index) =>
          text !== null && rect !== null ? (
            <div
              // The line's three labels are its own, by their place.
              // oxlint-disable-next-line react/no-array-index-key
              key={index}
              className={clsx(classes.labelBox, kind as string, className)}
              style={labelStyle(rect as Rect)}
            >
              {text as string}
            </div>
          ) : null,
        )}
      </EdgeLabelRenderer>
    </>
  );
}

const NODE_TYPES = { box: BoxNodeView, frame: FrameNodeView };
/** How long a step of a playing diagram stays before the next. */
const STEP_MS = 1500;
const EDGE_TYPES = { line: LineEdgeView };

/** Every kind of line end, as a marker, in the line's colour and the highlight's. */
function Markers({ id }: { id: string }) {
  const shapes: Record<Exclude<LineEnd, 'none'>, ReactNode> = {
    arrow: <path d="M 0 0 L 10 5 L 0 10 z" className={classes.fill} />,
    openArrow: <path d="M 0 0 L 10 5 L 0 10" className={classes.stroke} />,
    triangle: <path d="M 0 0 L 10 5 L 0 10 z" className={classes.hollow} />,
    circle: <circle cx="5" cy="5" r="4" className={classes.hollow} />,
    cross: <path d="M 1 1 L 9 9 M 9 1 L 1 9" className={classes.stroke} />,
    diamond: <path d="M 0 5 L 5 1 L 10 5 L 5 9 z" className={classes.hollow} />,
    filledDiamond: (
      <path d="M 0 5 L 5 1 L 10 5 L 5 9 z" className={classes.fill} />
    ),
    one: <path d="M 6 0 L 6 10 M 9 0 L 9 10" className={classes.stroke} />,
    zeroOrOne: (
      <>
        <path d="M 9 0 L 9 10" className={classes.stroke} />
        <circle cx="4" cy="5" r="3" className={classes.hollow} />
      </>
    ),
    oneOrMore: (
      <path
        d="M 10 5 L 0 0 M 10 5 L 0 10 M 10 5 L 0 5 M 3 0 L 3 10"
        className={classes.stroke}
      />
    ),
    zeroOrMore: (
      <>
        <path
          d="M 10 5 L 3 0 M 10 5 L 3 10 M 10 5 L 3 5"
          className={classes.stroke}
        />
        <circle cx="2.5" cy="5" r="2.5" className={classes.hollow} />
      </>
    ),
  };
  return (
    <svg className={classes.markers} aria-hidden>
      <defs>
        {(['n', 'h'] as const).map((tone) =>
          Object.entries(shapes).map(([end, shape]) => (
            <marker
              key={`${end}-${tone}`}
              id={`${id}-${end}-${tone}`}
              className={
                tone === 'h' ? classes.markerHighlight : classes.marker
              }
              viewBox="0 0 10 10"
              refX="10"
              refY="5"
              markerWidth="11"
              markerHeight="11"
              markerUnits="userSpaceOnUse"
              orient="auto-start-reverse"
            >
              {shape}
            </marker>
          )),
        )}
      </defs>
    </svg>
  );
}

/** How finely the canvas follows its column's width, so a scrollbar coming and going does not move it. */
const WIDTH_STEP = 24;

/**
 * The width of what the ref is on, in steps, read on the frame after it
 * changes: the canvas's height follows it, and a change made while the
 * browser is still delivering the resize would loop it.
 */
function useWidth() {
  const ref = useRef<HTMLElement | null>(null);
  const [width, setWidth] = useState(0);
  useEffect(() => {
    const element = ref.current;
    if (element === null) return;
    let frame = 0;
    const observer = new ResizeObserver(([entry]) => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        const measured = entry?.contentRect.width ?? 0;
        setWidth(Math.floor(measured / WIDTH_STEP) * WIDTH_STEP);
      });
    });
    observer.observe(element);
    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
    };
  }, []);
  return { ref, width };
}

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
  const [zoom, setZoom] = useState(1);
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
    setSelection((held) =>
      !adding
        ? held.length === 1 && held[0] === id
          ? []
          : [id]
        : held.includes(id)
          ? held.filter((each) => each !== id)
          : [...held, id],
    );
  }, []);
  const letGo = useCallback(() => {
    setSelection([]);
    stop();
  }, [stop]);

  // Escape lets go, as on the other diagrams; in a field or a dialog's own
  // controls it is theirs. Heard on its way down.
  useEffect(() => {
    if (selection.length === 0 && step === null) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      const target = event.target;
      if (
        target instanceof HTMLElement &&
        (target.isContentEditable ||
          target instanceof HTMLInputElement ||
          target instanceof HTMLTextAreaElement ||
          target.closest('[role="menu"]') !== null)
      )
        return;
      letGo();
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [selection, step, letGo]);

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
  const { ref: frame, width: across } = useWidth();
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
          nodesConnectable={false}
          nodesFocusable={false}
          edgesFocusable={false}
          elementsSelectable={false}
          // Inline, the wheel scrolls the page; a pinch, or Ctrl/Cmd and the
          // wheel, zooms. Full screen, the wheel zooms.
          zoomOnScroll={fullScreen}
          preventScrolling={fullScreen}
          zoomOnPinch
          panOnDrag
          onPaneClick={letGo}
          onInit={(instance) => {
            setFlow(instance as unknown as ReactFlowInstance);
            setZoom(instance.getZoom());
          }}
          onMove={(_, viewport) => setZoom(viewport.zoom)}
          attributionPosition="bottom-right"
        >
          <Background
            variant={BackgroundVariant.Dots}
            gap={20}
            size={1}
            color="light-dark(var(--mantine-color-gray-3), var(--mantine-color-dark-4))"
            bgColor="light-dark(var(--mantine-color-gray-0), var(--mantine-color-dark-7))"
          />
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
              <ZoomControls
                quiet
                zoom={zoom}
                disabled={flow === null}
                onZoomOut={() => void flow?.zoomOut()}
                onZoomIn={() => void flow?.zoomIn()}
                onFit={() => void flow?.fitView(fit)}
              />
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
