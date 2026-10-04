import { IconFocusCentered, IconMinus, IconPlus } from '@tabler/icons-react';
import {
  type Edge,
  Handle,
  MarkerType,
  type Node,
  type NodeProps,
  Position,
  ReactFlow,
  type ReactFlowInstance,
} from '@xyflow/react';
import '@xyflow/react/dist/base.css';
import { useMemo, useState } from 'react';
import { ActionIcon } from '#/shared/design-system/action-icon.tsx';
import { useComputedColorScheme } from '#/shared/design-system/color-scheme.ts';
import { Switch } from '#/shared/design-system/switch.tsx';
import { VisuallyHidden } from '#/shared/design-system/visually-hidden.tsx';
import { KindIcon } from '#/shared/ui/model-tree/kind-icon.tsx';
import { patternLabelOf } from '#/shared/ui/model-tree/model-outline.ts';
import type { ArchitectureOutline } from '../architecture-outline.ts';
import type { DiagramFocus } from './architecture-selection.ts';
import {
  type ArchitectureLayout,
  CORE_HEX_INSET,
  hexagonPoints,
  type LaidOutEdge,
  type LaidOutNode,
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
  layout: ArchitectureLayout;
  focus: DiagramFocus;
  onSelectElement: (id: string) => void;
}

interface Overlays {
  checks: boolean;
  rules: boolean;
}

interface CardData extends Record<string, unknown> {
  node: LaidOutNode;
  state: 'selected' | 'related' | undefined;
  warnings: number;
  notes: number;
  rules: number | null;
  onSelect: (id: string) => void;
}

type CardNode = Node<CardData>;

const NODE_TYPES = {
  hexagon: HexagonNode,
  domainCore: DomainCoreNode,
  card: CardNode,
};

export function ArchitectureDiagram({
  outline,
  layout,
  focus,
  onSelectElement,
}: ArchitectureDiagramProps) {
  const [overlays, setOverlays] = useState<Overlays>({
    checks: true,
    rules: false,
  });
  const scheme = useComputedColorScheme('light');
  /* Held from `onInit` rather than read from a provider around the toolbar:
     React Flow's own provider is what seeds the nodes before the first paint. */
  const [flow, setFlow] = useState<ReactFlowInstance<CardNode> | null>(null);
  const [zoom, setZoom] = useState(1);
  const findings = useMemo(() => findingsOf(outline), [outline]);
  const nodes = useMemo<CardNode[]>(
    () =>
      layout.nodes.map((node) => {
        const found = findings.get(node.id);
        return {
          id: node.id,
          type: FRAMES.has(node.kind) ? node.kind : 'card',
          position: { x: node.x, y: node.y },
          width: node.width,
          height: node.height,
          zIndex: FRAMES.has(node.kind) ? 0 : 1,
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
            onSelect: onSelectElement,
          },
        };
      }),
    [layout, findings, focus, overlays, onSelectElement],
  );
  const edges = useMemo(() => layout.edges.map(edgeOf), [layout]);
  const allAdded = layout.nodes.every(
    ({ element }) => element === null || element.change === 'added',
  );

  return (
    <div className={classes.diagram}>
      <div className={classes.toolbar}>
        <div className={classes.toolbarRow}>
          <Legend />
          <span className={classes.grow} />
          <Switch
            size="xs"
            label="Check markers"
            checked={overlays.checks}
            onChange={(event) => {
              const { checked } = event.currentTarget;
              setOverlays((was) => ({ ...was, checks: checked }));
            }}
          />
          <Switch
            size="xs"
            label="Rule counts"
            checked={overlays.rules}
            onChange={(event) => {
              const { checked } = event.currentTarget;
              setOverlays((was) => ({ ...was, rules: checked }));
            }}
          />
          <Zoom flow={flow} zoom={zoom} />
        </div>
        <p className={classes.note}>
          {allAdded && 'Green field: every element is added. '}
          Lines show what the design document holds; calls between services and
          driven ports are not in it.
          {outline.unplaced.length > 0 &&
            ` Not drawn, as the design leaves their type as it is: ${outline.unplaced.map(({ name }) => name).join(', ')}.`}
        </p>
      </div>
      <section className={classes.canvas} aria-label="Hexagons of the design">
        {layout.nodes.length === 0 ? (
          <p className={classes.empty}>
            This design places no building block in a module.
          </p>
        ) : (
          <ReactFlow
            nodes={nodes}
            edges={edges}
            nodeTypes={NODE_TYPES}
            colorMode={scheme}
            fitView
            fitViewOptions={FIT}
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
          />
        )}
      </section>
    </div>
  );
}

const FIT = { padding: 0.08 };

const FRAMES = new Set<LaidOutNode['kind']>(['hexagon', 'domainCore']);

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

function edgeOf(edge: LaidOutEdge): Edge {
  return {
    id: edge.id,
    source: edge.source,
    target: edge.target,
    type: 'straight',
    className: classes.edge,
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

function HexagonNode({ data, width = 0, height = 0 }: NodeProps<CardNode>) {
  const { node, state, onSelect } = data;
  return (
    <div className={classes.frame} data-state={state}>
      <svg
        width={width}
        height={height}
        aria-hidden
        className={classes.hexagon}
      >
        <polygon points={hexagonPoints(width, height)} />
      </svg>
      <button
        type="button"
        className={classes.moduleLabel}
        aria-pressed={state === 'selected'}
        aria-label={`${node.label}, module drawn as a hexagon`}
        onClick={() => onSelect(node.selects)}
      >
        <b>{node.label}</b> <small>module</small>
      </button>
    </div>
  );
}

function DomainCoreNode({ width = 0, height = 0 }: NodeProps<CardNode>) {
  return (
    <div className={classes.frame}>
      <svg width={width} height={height} aria-hidden className={classes.core}>
        <polygon points={hexagonPoints(width, height, CORE_HEX_INSET)} />
      </svg>
      <span className={classes.ringLabel}>Domain core</span>
    </div>
  );
}

const SUBTITLE: Partial<Record<LaidOutNode['kind'], string>> = {
  adapterIn: 'not designed',
  adapterOut: 'not designed',
  caller: 'caller unknown',
};

const KIND_WORD: Record<LaidOutNode['kind'], string> = {
  hexagon: 'module',
  domainCore: 'domain core',
  actor: 'actor',
  caller: 'unknown caller',
  adapterIn: 'in adapter, not designed',
  adapterOut: 'out adapter, not designed',
  drivingPort: 'driving port',
  service: 'application service',
  element: 'domain core',
  drivenPort: 'driven port',
};

function CardNode({ data }: NodeProps<CardNode>) {
  const { node, state, warnings, notes, rules, onSelect } = data;
  const { element } = node;
  const pattern = element?.pattern ?? null;
  const subtitle = SUBTITLE[node.kind] ?? patternLabelOf(pattern);
  const label = [
    node.label,
    KIND_WORD[node.kind],
    element !== null && pattern !== null ? patternLabelOf(pattern) : null,
    element?.change !== undefined && element.change !== 'unchanged'
      ? element.change
      : null,
    warnings > 0 ? plural(warnings, 'warning') : null,
    notes > 0 ? plural(notes, 'note') : null,
    rules !== null ? plural(rules, 'rule') : null,
  ]
    .filter((part) => part !== null)
    .join(', ');
  return (
    <>
      <Handle
        type="target"
        position={Position.Top}
        className={classes.handle}
      />
      <button
        type="button"
        className={classes.card}
        data-kind={node.kind}
        data-state={state}
        data-change={element?.change}
        aria-pressed={state === 'selected'}
        aria-label={label}
        title={label}
        onClick={() => onSelect(node.selects)}
      >
        {element !== null && (
          <span className={classes.icon}>
            <KindIcon
              kind={
                element.id.startsWith('behavior|')
                  ? 'behaviour'
                  : 'building_block'
              }
              pattern={pattern}
            />
          </span>
        )}
        <span className={classes.text}>
          <b>{node.label}</b>
          {subtitle !== null && <small>{subtitle}</small>}
        </span>
        {(warnings > 0 || notes > 0) && (
          <span
            className={classes.marker}
            data-level={warnings > 0 ? 'warning' : 'note'}
            aria-hidden
          >
            {warnings > 0 ? '!' : 'i'}
          </span>
        )}
        {rules !== null && (
          <span className={classes.ruleCount} aria-hidden>
            {plural(rules, 'rule')}
          </span>
        )}
      </button>
      <Handle
        type="source"
        position={Position.Bottom}
        className={classes.handle}
      />
    </>
  );
}

const plural = (count: number, word: string) =>
  `${count} ${count === 1 ? word : `${word}s`}`;

const LEGEND: { kind: LaidOutNode['kind'] | 'core'; label: string }[] = [
  { kind: 'adapterIn', label: 'In / out adapter' },
  { kind: 'drivingPort', label: 'Driving port' },
  { kind: 'service', label: 'Application service' },
  { kind: 'core', label: 'Domain core' },
  { kind: 'drivenPort', label: 'Driven port' },
];

function Legend() {
  return (
    <ul className={classes.legend} aria-label="Legend">
      {LEGEND.map(({ kind, label }) => (
        <li key={kind}>
          <span className={classes.swatch} data-kind={kind} aria-hidden />
          {label}
        </li>
      ))}
    </ul>
  );
}

function Zoom({
  flow,
  zoom,
}: {
  flow: ReactFlowInstance<CardNode> | null;
  zoom: number;
}) {
  return (
    <fieldset className={classes.zoom}>
      <VisuallyHidden component="legend">Zoom</VisuallyHidden>
      <ActionIcon
        variant="default"
        size="md"
        aria-label="Zoom out"
        title="Zoom out"
        disabled={flow === null}
        onClick={() => void flow?.zoomOut()}
      >
        <IconMinus size={16} stroke={1.6} aria-hidden />
      </ActionIcon>
      <output
        className={classes.zoomLevel}
      >{`${Math.round(zoom * 100)}%`}</output>
      <ActionIcon
        variant="default"
        size="md"
        aria-label="Zoom in"
        title="Zoom in"
        disabled={flow === null}
        onClick={() => void flow?.zoomIn()}
      >
        <IconPlus size={16} stroke={1.6} aria-hidden />
      </ActionIcon>
      <ActionIcon
        variant="default"
        size="md"
        aria-label="Fit to view"
        title="Fit to view"
        disabled={flow === null}
        onClick={() => void flow?.fitView(FIT)}
      >
        <IconFocusCentered size={16} stroke={1.6} aria-hidden />
      </ActionIcon>
    </fieldset>
  );
}
