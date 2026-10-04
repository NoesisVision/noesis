import {
  IconChevronDown,
  IconChevronUp,
  IconFocusCentered,
  IconMinus,
  IconPlus,
} from '@tabler/icons-react';
import {
  type Edge,
  Handle,
  MarkerType,
  type Node,
  type NodeProps,
  Panel,
  Position,
  ReactFlow,
  type ReactFlowInstance,
} from '@xyflow/react';
import '@xyflow/react/dist/base.css';
import { type CSSProperties, useId, useMemo, useState } from 'react';
import { ActionIcon } from '#/shared/design-system/action-icon.tsx';
import { useComputedColorScheme } from '#/shared/design-system/color-scheme.ts';
import { Switch } from '#/shared/design-system/switch.tsx';
import { VisuallyHidden } from '#/shared/design-system/visually-hidden.tsx';
import { ChangeMark } from '#/shared/ui/model-tree/change-mark.tsx';
import { KindIcon } from '#/shared/ui/model-tree/kind-icon.tsx';
import {
  type OutlineChange,
  patternLabelOf,
} from '#/shared/ui/model-tree/model-outline.ts';
import { useChangeColour } from '#/shared/ui/model-tree/use-change-colour.ts';
import type { ArchitectureOutline } from '../architecture-outline.ts';
import type { TypeRing } from '../building-block-types.ts';
import type { DiagramFocus } from './architecture-selection.ts';
import { BuildingBlockFilter } from './building-block-filter.tsx';
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
  /** The hexagons as drawn: without the building block types the reader left out. */
  layout: ArchitectureLayout;
  focus: DiagramFocus;
  onSelectElement: (id: string) => void;
  /** The building block types the hexagons hold, the ones to be left out, and the way to change them. */
  types: TypeRing[];
  hiddenTypes: ReadonlySet<string>;
  onHideTypes: (hidden: ReadonlySet<string>) => void;
}

interface Overlays {
  checks: boolean;
  rules: boolean;
  changes: boolean;
}

interface CardData extends Record<string, unknown> {
  node: LaidOutNode;
  state: 'selected' | 'related' | undefined;
  warnings: number;
  notes: number;
  rules: number | null;
  /** What the design does to the card's element, marked as the tree marks it; `unchanged` when the reader hides it. */
  change: OutlineChange;
  changeColour: string | undefined;
  onSelect: (id: string) => void;
}

type CardNode = Node<CardData>;

const NODE_TYPES = {
  hexagon: HexagonNode,
  domainCore: DomainCoreNode,
  card: CardNode,
};

/** A card's border and fill, and its ink when that is not the text's. */
interface Look {
  border: string;
  fill: string;
  ink?: string;
}

interface Kind {
  /** The node type that draws it. */
  type: keyof typeof NODE_TYPES;
  /** What a screen reader hears it called. */
  word: string;
  subtitle?: string;
  /** What the legend calls it; kinds that share a name share an entry. */
  legend?: string;
  look?: Look;
}

const CARD_LOOK: Look = {
  border: '1px solid var(--arch-edge)',
  fill: 'var(--arch-card)',
};
const NOT_DESIGNED: Look = {
  border: '1.5px dashed var(--arch-edge)',
  fill: 'var(--arch-card)',
  ink: 'var(--arch-dim)',
};

/*
 * Every kind of node, by what the layout calls it: the node type that draws
 * it, its look, and its name in the legend. The cards and the legend both read
 * this one map, so the legend cannot say what the cards do not show.
 */
const KINDS: Record<LaidOutNode['kind'], Kind> = {
  hexagon: { type: 'hexagon', word: 'module' },
  domainCore: { type: 'domainCore', word: 'domain core' },
  actor: { type: 'card', word: 'actor' },
  caller: {
    type: 'card',
    word: 'unknown caller',
    subtitle: 'caller unknown',
    look: NOT_DESIGNED,
  },
  adapterIn: {
    type: 'card',
    word: 'in adapter, not designed',
    subtitle: 'not designed',
    legend: 'In / out adapter',
    look: NOT_DESIGNED,
  },
  adapterOut: {
    type: 'card',
    word: 'out adapter, not designed',
    subtitle: 'not designed',
    legend: 'In / out adapter',
    look: NOT_DESIGNED,
  },
  drivingPort: {
    type: 'card',
    word: 'driving port',
    legend: 'Driving port',
    look: {
      border: '1px solid transparent',
      fill: 'var(--mantine-color-brand-filled)',
      ink: 'var(--mantine-color-white)',
    },
  },
  service: {
    type: 'card',
    word: 'application service',
    legend: 'Application service',
    look: {
      border: '1px solid var(--arch-hex-line)',
      fill: 'var(--arch-card)',
    },
  },
  element: {
    type: 'card',
    word: 'domain core',
    legend: 'Domain core',
    look: {
      border: '1px solid var(--arch-core-line)',
      fill: 'var(--arch-card)',
    },
  },
  drivenPort: {
    type: 'card',
    word: 'driven port',
    legend: 'Driven port',
    look: {
      border: '2px solid var(--mantine-color-brand-filled)',
      fill: 'var(--arch-card)',
    },
  },
};

const isFrame = (kind: LaidOutNode['kind']) => KINDS[kind].type !== 'card';

/** Whether a node fades while the reader picks out these kinds; a frame is the backdrop and never does. */
const fades = (
  kind: LaidOutNode['kind'],
  picked: LaidOutNode['kind'][] | undefined,
) => picked !== undefined && !isFrame(kind) && !picked.includes(kind);

/** A look as the custom properties the card and the legend's swatch read. */
const styleOf = ({ border, fill, ink }: Look = CARD_LOOK) =>
  ({
    '--kind-border': border,
    '--kind-fill': fill,
    '--kind-ink': ink,
  }) as CSSProperties;

interface LegendEntry {
  label: string;
  kinds: LaidOutNode['kind'][];
  look: Look | undefined;
}

const LEGEND: LegendEntry[] = [];
for (const [kind, { legend, look }] of Object.entries(KINDS) as [
  LaidOutNode['kind'],
  Kind,
][]) {
  if (legend === undefined) continue;
  const entry = LEGEND.find(({ label }) => label === legend);
  if (entry === undefined) LEGEND.push({ label: legend, kinds: [kind], look });
  else entry.kinds.push(kind);
}

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
  const [flow, setFlow] = useState<ReactFlowInstance<CardNode> | null>(null);
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
  const nodes = useMemo<CardNode[]>(
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
      <div className={classes.toolbar}>
        <div className={classes.toolbarRow}>
          <span className={classes.grow} />
          <BuildingBlockFilter
            rings={types}
            hidden={hiddenTypes}
            onHide={onHideTypes}
          />
          <Switch
            size="xs"
            label="Changes"
            checked={overlays.changes}
            onChange={(event) => {
              const { checked } = event.currentTarget;
              setOverlays((was) => ({ ...was, changes: checked }));
            }}
          />
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
        {outline.unplaced.length > 0 && (
          <p className={classes.note}>
            {`Not drawn, as the design leaves their type as it is: ${outline.unplaced.map(({ name }) => name).join(', ')}.`}
          </p>
        )}
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

function CardNode({ data }: NodeProps<CardNode>) {
  const {
    node,
    state,
    warnings,
    notes,
    rules,
    change,
    changeColour,
    onSelect,
  } = data;
  const { element } = node;
  const pattern = element?.pattern ?? null;
  const kind = KINDS[node.kind];
  const subtitle = kind.subtitle ?? patternLabelOf(pattern);
  const label = [
    node.label,
    kind.word,
    element !== null && pattern !== null ? patternLabelOf(pattern) : null,
    change !== 'unchanged' ? change : null,
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
        style={styleOf(kind.look)}
        data-state={state}
        data-change={change}
        aria-pressed={state === 'selected'}
        aria-label={label}
        title={label}
        onClick={() => onSelect(node.selects)}
      >
        {element !== null && (
          <span className={classes.icon}>
            <ChangeMark change={change} color={changeColour}>
              <KindIcon
                kind={
                  element.id.startsWith('behavior|')
                    ? 'behaviour'
                    : 'building_block'
                }
                pattern={pattern}
              />
            </ChangeMark>
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

/*
 * The legend floats over the canvas, still while it pans and zooms. Each
 * entry is a toggle: pressed, it picks out the cards of its kind and fades
 * the rest; pressed again, every card is alike. Folded away, it is only its
 * title, and nothing stays picked out that the reader cannot see the reason for.
 */
function Legend({
  entries,
  picked,
  onPick,
}: {
  entries: LegendEntry[];
  picked: string | null;
  onPick: (label: string | null) => void;
}) {
  const [open, setOpen] = useState(false);
  const list = useId();
  if (entries.length === 0) return null;
  const Chevron = open ? IconChevronDown : IconChevronUp;
  return (
    <Panel position="bottom-right" className={classes.legend}>
      <button
        type="button"
        className={classes.legendToggle}
        aria-expanded={open}
        aria-controls={list}
        onClick={() => {
          setOpen(!open);
          onPick(null);
        }}
      >
        Legend
        <Chevron size={14} stroke={1.8} aria-hidden />
      </button>
      <ul id={list} hidden={!open} aria-label="Legend: pick out a kind of card">
        {entries.map(({ label, look }) => (
          <li key={label}>
            <button
              type="button"
              className={classes.legendEntry}
              aria-pressed={picked === label}
              onClick={() => onPick(picked === label ? null : label)}
            >
              <span
                className={classes.swatch}
                style={styleOf(look)}
                aria-hidden
              />
              {label}
            </button>
          </li>
        ))}
      </ul>
    </Panel>
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
