import {
  type Edge,
  MarkerType,
  ReactFlow,
  type ReactFlowInstance,
} from '@xyflow/react';
import '@xyflow/react/dist/base.css';
import { useMemo, useState } from 'react';
import { useComputedColorScheme } from '#/shared/design-system/color-scheme.ts';
import { Text } from '#/shared/design-system/text.tsx';
import { useChangeColour } from '#/shared/ui/model-tree/use-change-colour.ts';
import { ZoomControls } from '#/shared/ui/zoom-controls.tsx';
import type { ArchitectureOutline } from '../../architecture-outline.ts';
import type { TypeRing } from '../../building-block-types.ts';
import { isFrame, type Kind, KINDS, LEGEND } from './architecture-kinds.ts';
import type { DiagramFocus } from './architecture-selection.ts';
import { Legend } from './diagram-legend.tsx';
import {
  CardNode,
  type DiagramNode,
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

/** Whether a node fades while the reader picks out these kinds; a frame is the backdrop and never does. */
const fades = (
  kind: LaidOutNode['kind'],
  picked: LaidOutNode['kind'][] | undefined,
) => picked !== undefined && !isFrame(kind) && !picked.includes(kind);

export function ArchitectureDiagram({
  outline,
  layout,
  focus,
  onSelectElement,
  types,
  hiddenTypes,
  onHideTypes,
}: ArchitectureDiagramProps) {
  const [overlays, setOverlays] = useState<Overlays>({
    checks: true,
    rules: false,
    changes: true,
  });
  const changeColour = useChangeColour();
  const scheme = useComputedColorScheme('light');
  /* Held from `onInit` rather than read from a provider around the toolbar:
     React Flow's own provider is what seeds the nodes before the first paint. */
  const [flow, setFlow] = useState<ReactFlowInstance<DiagramNode> | null>(null);
  const [zoom, setZoom] = useState(1);
  /* The legend entry the reader picked out, by its name: the rest fade. */
  const [picked, setPicked] = useState<string | null>(null);
  const findings = useMemo(() => findingsOf(outline), [outline]);
  // Only the kinds drawn: an entry that picks out nothing is no use.
  const legend = useMemo(() => {
    const drawn = new Set(layout.nodes.map(({ kind }) => kind));
    return LEGEND.filter(({ kinds }) => kinds.some((kind) => drawn.has(kind)));
  }, [layout]);
  const pickedKinds = legend.find(({ label }) => label === picked)?.kinds;
  const nodes = useMemo<DiagramNode[]>(
    () =>
      layout.nodes.map((node) => {
        const found = findings.get(node.id);
        return {
          id: node.id,
          type: KINDS[node.kind].type,
          position: { x: node.x, y: node.y },
          width: node.width,
          height: node.height,
          zIndex: isFrame(node.kind) ? 0 : 1,
          className: fades(node.kind, pickedKinds) ? classes.faded : undefined,
          data: {
            node,
            state: focus.selected.has(node.id)
              ? 'selected'
              : focus.related.has(node.id)
                ? 'related'
                : undefined,
            warnings: overlays.checks ? (found?.warnings ?? 0) : 0,
            notes: overlays.checks ? (found?.notes ?? 0) : 0,
            rules:
              overlays.rules && node.element !== null
                ? node.element.rules.length
                : null,
            change:
              overlays.changes && node.element !== null
                ? node.element.change
                : 'unchanged',
            changeColour:
              overlays.changes && node.element !== null
                ? changeColour(node.element.change)?.color
                : undefined,
            onSelect: onSelectElement,
          },
        };
      }),
    [
      layout,
      findings,
      focus,
      overlays,
      changeColour,
      onSelectElement,
      pickedKinds,
    ],
  );
  const edges = useMemo(() => {
    const kindOf = new Map(layout.nodes.map(({ id, kind }) => [id, kind]));
    const fadesAt = (id: string) => {
      const kind = kindOf.get(id);
      return kind !== undefined && fades(kind, pickedKinds);
    };
    // A line fades only when both its ends do.
    return layout.edges.map((edge) =>
      edgeOf(edge, fadesAt(edge.source) && fadesAt(edge.target)),
    );
  }, [layout, pickedKinds]);

  return (
    <div className={classes.diagram}>
      <DiagramToolbar
        types={types}
        hiddenTypes={hiddenTypes}
        onHideTypes={onHideTypes}
        overlays={overlays}
        onOverlays={setOverlays}
        unplaced={outline.unplaced}
      >
        <ZoomControls
          zoom={zoom}
          disabled={flow === null}
          onZoomOut={() => void flow?.zoomOut()}
          onZoomIn={() => void flow?.zoomIn()}
          onFit={() => void flow?.fitView(FIT)}
        />
      </DiagramToolbar>
      <section className={classes.canvas} aria-label="Hexagons of the design">
        {layout.nodes.length === 0 ? (
          <Text c="dimmed" p="lg">
            This design places no building block in a module.
          </Text>
        ) : (
          <ReactFlow
            nodes={nodes}
            edges={edges}
            nodeTypes={NODE_TYPES}
            colorMode={scheme}
            fitView
            fitViewOptions={FIT}
            // The bottom right corner is the legend's.
            attributionPosition="bottom-left"
            minZoom={0.2}
            maxZoom={2}
            nodesDraggable={false}
            nodesConnectable={false}
            nodesFocusable={false}
            edgesFocusable={false}
            elementsSelectable={false}
            onInit={(instance) => {
              setFlow(instance);
              setZoom(instance.getZoom());
            }}
            onMove={(_, viewport) => setZoom(viewport.zoom)}
          >
            <Legend entries={legend} picked={picked} onPick={setPicked} />
          </ReactFlow>
        )}
      </section>
    </div>
  );
}

const FIT = { padding: 0.08 };

/** How many warnings and notes name each card's element. */
function findingsOf(outline: ArchitectureOutline) {
  const found = new Map<string, { warnings: number; notes: number }>();
  for (const check of outline.checks) {
    if (check.level === 'pass') continue;
    for (const id of check.elementIds) {
      const counts = found.get(id) ?? { warnings: 0, notes: 0 };
      if (check.level === 'warning') counts.warnings += 1;
      else counts.notes += 1;
      found.set(id, counts);
    }
  }
  return found;
}

const ARROW = {
  type: MarkerType.ArrowClosed,
  color: 'var(--arch-edge)',
  width: 16,
  height: 16,
};

function edgeOf(edge: LaidOutEdge, faded: boolean): Edge {
  return {
    id: edge.id,
    source: edge.source,
    target: edge.target,
    type: 'straight',
    className: faded ? `${classes.edge} ${classes.faded}` : classes.edge,
    // The adapters are not designed, so the lines to them are not either.
    style: { strokeDasharray: DASHED.has(edge.kind) ? '6 6' : undefined },
    ...(edge.kind === 'owns'
      ? {}
      : edge.kind === 'implements'
        ? { markerStart: ARROW }
        : { markerEnd: ARROW }),
  };
}

const DASHED = new Set<LaidOutEdge['kind']>(['adapts', 'implements']);
