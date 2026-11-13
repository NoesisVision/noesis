import {
  Background,
  MarkerType,
  ReactFlow,
  type ReactFlowInstance,
} from '@xyflow/react';
import { clsx } from 'clsx';
import { type ReactNode, useMemo, useRef, useState } from 'react';
import { useChangeColour } from '#/features/design-docs/ui/model-tree/use-change-colour.ts';
import { Box } from '#/shared/design-system/box.tsx';
import { useComputedColorScheme } from '#/shared/design-system/color-scheme.ts';
import { Stack } from '#/shared/design-system/stack.tsx';
import '@xyflow/react/dist/base.css';
import { Text } from '#/shared/design-system/text.tsx';
import { DOT_GRID } from '#/shared/ui/diagram-canvas/canvas-background.ts';
import {
  CANVAS_FLOW,
  useCanvasZoom,
} from '#/shared/ui/diagram-canvas/canvas-flow.ts';
import { useLetGoOnEscape } from '#/shared/ui/diagram-canvas/canvas-keys.ts';
import { FIT } from '#/shared/ui/diagram-canvas/fit.ts';
import {
  type FloatingEdge,
  FloatingEdgeView,
} from '#/shared/ui/diagram-canvas/floating-edge.tsx';
import { useEvenCtrlZoom } from '#/shared/ui/diagram-canvas/use-even-ctrl-zoom.ts';
import { ZoomControls } from '#/shared/ui/zoom-controls.tsx';
import type { ArchitectureOutline } from '../../architecture-outline.ts';
import type { TypeRing } from '../../building-block-types.ts';
import {
  fades,
  isFrame,
  type Kind,
  KINDS,
  LEGEND,
} from './architecture-kinds.ts';
import {
  cardIdOf,
  clearOf,
  type DiagramFocus,
} from './architecture-selection.ts';
import { Legend } from './diagram-legend.tsx';
import {
  CardNode,
  type DiagramNode,
  type DiagramReading,
  DiagramReadingContext,
  DomainCoreNode,
  HexagonNode,
} from './diagram-nodes.tsx';
import { DiagramToolbar, type Overlays } from './diagram-toolbar.tsx';
import type {
  ArchitectureLayout,
  LaidOutEdge,
  LaidOutNode,
} from './layout-architecture.ts';
import classes from './architecture-diagram.module.css';

/*
 * The hexagons, drawn from the layout: React Flow pans, zooms and fits them;
 * what each card is and how it looks is ours. Cards are buttons, so a card is
 * chosen by pointer or by keyboard alike; the tree beside the diagram stays
 * the way through the view for a reader who cannot see it.
 */

export interface ArchitectureDiagramProps {
  outline: ArchitectureOutline;
  /** The hexagons as drawn: without the building block types the reader left out. */
  layout: ArchitectureLayout;
  focus: DiagramFocus;
  onSelectElement: (id: string) => void;
  /** Lets go of what is in hand: a click on the empty canvas, as on the exploration. */
  onClear?: () => void;
  /** The `DetailsDock` the selection is read in, on the canvas beside the cards it outlines; none with nothing in hand. */
  selection?: ReactNode;
  /** The building block types the hexagons hold, the ones to be left out, and the way to change them. */
  types: TypeRing[];
  hiddenTypes: ReadonlySet<string>;
  onHideTypes: (hidden: ReadonlySet<string>) => void;
}

const NODE_TYPES = {
  hexagon: HexagonNode,
  domainCore: DomainCoreNode,
  card: CardNode,
} satisfies Record<Kind['type'], unknown>;

/** Every line floats, meeting each card at its border, as on the exploration. */
const EDGE_TYPES = { floating: FloatingEdgeView };

export function ArchitectureDiagram({
  outline,
  layout,
  focus,
  onSelectElement,
  onClear,
  selection = null,
  types,
  hiddenTypes,
  onHideTypes,
}: ArchitectureDiagramProps) {
  // Escape lets go of what is in hand, as on the exploration.
  useLetGoOnEscape(onClear !== undefined, onClear ?? NOTHING);
  const [overlays, setOverlays] = useState<Overlays>({
    checks: true,
    rules: false,
    changes: true,
  });
  const changeColour = useChangeColour();
  const scheme = useComputedColorScheme('light');
  /* Held from `onInit` rather than read from a provider around the toolbar:
     React Flow's own provider is what seeds the nodes before the first paint. */
  const [flow, setFlow] = useState<ReactFlowInstance<
    DiagramNode,
    FloatingEdge
  > | null>(null);
  const zoom = useCanvasZoom(flow);
  // Ctrl and the wheel zoom as gently as on every diagram.
  const frame = useRef<HTMLElement>(null);
  useEvenCtrlZoom(frame);
  /* The legend entry the reader picked out, by its name: the rest fade. */
  const [picked, setPicked] = useState<string | null>(null);
  const findings = useMemo(
    () => findingsOf(outline, layout.nodes),
    [outline, layout],
  );
  // Only the kinds drawn: an entry that picks out nothing is no use.
  const legend = useMemo(() => {
    const drawn = new Set(layout.nodes.map(({ kind }) => kind));
    return LEGEND.filter(({ kinds }) => kinds.some((kind) => drawn.has(kind)));
  }, [layout]);
  const pickedKinds = legend.find(({ label }) => label === picked)?.kinds;
  // Of the layout alone, so a node stays the object React Flow has measured.
  const nodes = useMemo<DiagramNode[]>(
    () =>
      layout.nodes.map((node) => ({
        id: node.id,
        type: KINDS[node.kind].type,
        position: { x: node.x, y: node.y },
        width: node.width,
        height: node.height,
        zIndex: isFrame(node.kind) ? 0 : 1,
        data: { node },
      })),
    [layout],
  );
  const clear = useMemo(() => clearOf(focus, layout.nodes), [focus, layout]);
  const reading = useMemo<DiagramReading>(
    () => ({
      focus,
      clear,
      findings,
      overlays,
      changeColour,
      pickedKinds,
      onSelect: onSelectElement,
      onLetGo: onClear,
    }),
    [
      focus,
      clear,
      findings,
      overlays,
      changeColour,
      pickedKinds,
      onSelectElement,
      onClear,
    ],
  );
  const edges = useMemo(() => {
    const kindAt = new Map(layout.nodes.map(({ id, kind }) => [id, kind]));
    const fadesAt = (id: string) => {
      const kind = kindAt.get(id);
      return kind !== undefined && fades(kind, pickedKinds);
    };
    // With something in hand, a line stays clear between two cards that do,
    // or from the selection itself.
    const dimmedAt = (edge: LaidOutEdge) =>
      clear !== null &&
      !(clear.has(edge.source) && clear.has(edge.target)) &&
      !focus.selected.has(edge.source) &&
      !focus.selected.has(edge.target);
    // The selection's own lines stand out, as on the exploration.
    const highlightedAt = (edge: LaidOutEdge) =>
      focus.selected.has(edge.source) || focus.selected.has(edge.target);
    // A line fades only when both its ends do.
    return layout.edges.map((edge) =>
      edgeOf(
        edge,
        fadesAt(edge.source) && fadesAt(edge.target),
        dimmedAt(edge),
        highlightedAt(edge),
      ),
    );
  }, [layout, pickedKinds, clear, focus]);

  return (
    <Stack gap={0} flex={1} className={classes.diagram}>
      <DiagramToolbar
        types={types}
        hiddenTypes={hiddenTypes}
        onHideTypes={onHideTypes}
        overlays={overlays}
        onOverlays={setOverlays}
        unplaced={outline.unplaced}
      >
        <ZoomControls quiet {...zoom.controls} />
      </DiagramToolbar>
      <Box
        ref={frame}
        component="section"
        pos="relative"
        flex={1}
        mih={0}
        aria-label="Hexagons of the design"
      >
        {layout.nodes.length === 0 ? (
          <Text c="dimmed" p="lg">
            This design places no building block in a module.
          </Text>
        ) : (
          <DiagramReadingContext.Provider value={reading}>
            <ReactFlow
              nodes={nodes}
              edges={edges}
              nodeTypes={NODE_TYPES}
              edgeTypes={EDGE_TYPES}
              colorMode={scheme}
              fitView
              fitViewOptions={FIT}
              // The bottom left corner is the legend's.
              {...CANVAS_FLOW}
              minZoom={0.2}
              maxZoom={2}
              nodesDraggable={false}
              onPaneClick={onClear}
              onInit={(instance) => {
                setFlow(instance);
                zoom.readZoom(instance);
              }}
              onMove={zoom.onMove}
            >
              {selection}
              {/* The dot grid the Mermaid diagrams are drawn on, moving with the cards. */}
              <Background {...DOT_GRID} />
              <Legend entries={legend} picked={picked} onPick={setPicked} />
            </ReactFlow>
          </DiagramReadingContext.Provider>
        )}
      </Box>
    </Stack>
  );
}

/** How many warnings and notes name each card's element, or a behavior found on it. */
function findingsOf(
  outline: ArchitectureOutline,
  nodes: readonly LaidOutNode[],
) {
  const drawn = new Set(nodes.map(({ id }) => id));
  const found = new Map<string, { warnings: number; notes: number }>();
  for (const check of outline.checks) {
    if (check.level === 'pass') continue;
    // A block two of its behaviors put under one check is named by it once.
    const cards = new Set(check.elementIds.map((id) => cardIdOf(id, drawn)));
    for (const id of cards) {
      const counts = found.get(id) ?? { warnings: 0, notes: 0 };
      if (check.level === 'warning') counts.warnings += 1;
      else counts.notes += 1;
      found.set(id, counts);
    }
  }
  return found;
}

const arrowOf = (highlighted: boolean) => ({
  type: MarkerType.ArrowClosed,
  color: highlighted
    ? 'var(--noesis-diagram-highlight)'
    : 'var(--noesis-architecture-edge)',
  width: 16,
  height: 16,
});

function edgeOf(
  edge: LaidOutEdge,
  faded: boolean,
  dimmed: boolean,
  highlighted: boolean,
): FloatingEdge {
  const arrow = arrowOf(highlighted);
  return {
    id: edge.id,
    source: edge.source,
    target: edge.target,
    type: 'floating',
    // Straight: the cards stand where the hexagon's rings put them.
    data: { orthogonal: false, straight: true },
    // The selection's lines are drawn over the rest.
    zIndex: highlighted ? 1 : 0,
    className: clsx(
      classes.edge,
      faded && classes.faded,
      dimmed && classes.dimmedEdge,
      highlighted && classes.highlighted,
    ),
    // The adapters are not designed, so the lines to them are not either.
    style: { strokeDasharray: DASHED.has(edge.kind) ? '6 6' : undefined },
    ...(edge.kind === 'owns'
      ? {}
      : edge.kind === 'implements'
        ? { markerStart: arrow }
        : { markerEnd: arrow }),
  };
}

const DASHED = new Set<LaidOutEdge['kind']>(['adapts', 'implements']);

const NOTHING = () => {};
