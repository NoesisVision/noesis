import { Handle, type Node, type NodeProps, Position } from '@xyflow/react';
import { clsx } from 'clsx';
import { createContext, useContext } from 'react';
import { UnstyledButton } from '#/shared/design-system/unstyled-button.tsx';
import { ChangeMark } from '#/shared/ui/model-tree/change-mark.tsx';
import { KindIcon } from '#/shared/ui/model-tree/kind-icon.tsx';
import {
  type OutlineChange,
  patternLabelOf,
} from '#/shared/ui/model-tree/model-outline.ts';
import { counted } from '#/shared/ui/plural.ts';
import { kindOf } from '../../element-id.ts';
import { fades, KINDS } from './architecture-kinds.ts';
import type { DiagramFocus } from './architecture-selection.ts';
import {
  CORE_HEX_INSET,
  hexagonPoints,
  type LaidOutNode,
} from './layout-architecture.ts';
import classes from './architecture-diagram.module.css';

/*
 * What React Flow draws at each node of the layout: the two frames, and the
 * card every other kind is. A card and a module's name are buttons, so either
 * is chosen by pointer or by keyboard alike.
 */

/*
 * A node holds only where its card stands, so it is the same object for as
 * long as the layout is: React Flow measures a node it is handed anew, and
 * a selection must not cost a measuring of every card. What a card shows that
 * changes under the same layout — the selection, the overlays, the legend's
 * pick — reaches it through context instead.
 */
export type DiagramNode = Node<{ node: LaidOutNode }>;

export interface DiagramReading {
  focus: DiagramFocus;
  /** How many warnings and notes name each card, by its id. */
  findings: ReadonlyMap<string, { warnings: number; notes: number }>;
  overlays: { checks: boolean; rules: boolean; changes: boolean };
  changeColour: (change: OutlineChange) => { color: string } | null;
  /** The kinds the legend picks out; the rest fade. */
  pickedKinds: readonly LaidOutNode['kind'][] | undefined;
  onSelect: (id: string) => void;
}

const NOTHING_READ: DiagramReading = {
  focus: { selected: new Set(), related: new Set() },
  findings: new Map(),
  overlays: { checks: false, rules: false, changes: false },
  changeColour: () => null,
  pickedKinds: undefined,
  onSelect: () => {},
};

export const DiagramReadingContext = createContext(NOTHING_READ);

/** What one card shows of the reading. */
function useCard(node: LaidOutNode) {
  const { focus, findings, overlays, changeColour, pickedKinds, onSelect } =
    useContext(DiagramReadingContext);
  const found = overlays.checks ? findings.get(node.id) : undefined;
  /* What the design does to the card's element, marked as the tree marks it;
     `unchanged` when the reader hides it. */
  const change: OutlineChange =
    overlays.changes && node.element !== null
      ? node.element.change
      : 'unchanged';
  return {
    state: focus.selected.has(node.id)
      ? ('selected' as const)
      : focus.related.has(node.id)
        ? ('related' as const)
        : undefined,
    warnings: found?.warnings ?? 0,
    notes: found?.notes ?? 0,
    rules:
      overlays.rules && node.element !== null
        ? node.element.rules.length
        : null,
    change,
    changeColour: changeColour(change)?.color,
    faded: fades(node.kind, pickedKinds),
    onSelect,
  };
}

export function HexagonNode({
  data,
  width = 0,
  height = 0,
}: NodeProps<DiagramNode>) {
  const { node } = data;
  const { state, onSelect } = useCard(node);
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
      <UnstyledButton
        className={classes.moduleLabel}
        aria-pressed={state === 'selected'}
        aria-label={`${node.label}, module drawn as a hexagon`}
        onClick={() => onSelect(node.selects)}
      >
        <b>{node.label}</b> <small>module</small>
      </UnstyledButton>
    </div>
  );
}

export function DomainCoreNode({
  width = 0,
  height = 0,
}: NodeProps<DiagramNode>) {
  return (
    <div className={classes.frame}>
      <svg width={width} height={height} aria-hidden className={classes.core}>
        <polygon points={hexagonPoints(width, height, CORE_HEX_INSET)} />
      </svg>
      <span className={classes.ringLabel}>Domain core</span>
    </div>
  );
}

export function CardNode({ data }: NodeProps<DiagramNode>) {
  const { node } = data;
  const {
    state,
    warnings,
    notes,
    rules,
    change,
    changeColour,
    faded,
    onSelect,
  } = useCard(node);
  const { element } = node;
  const pattern = element?.pattern ?? null;
  const kind = KINDS[node.kind];
  const subtitle = kind.subtitle ?? patternLabelOf(pattern);
  const label = [
    node.label,
    kind.word,
    element !== null && pattern !== null ? patternLabelOf(pattern) : null,
    change !== 'unchanged' ? change : null,
    warnings > 0 ? counted(warnings, 'warning') : null,
    notes > 0 ? counted(notes, 'note') : null,
    rules !== null ? counted(rules, 'rule') : null,
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
      <UnstyledButton
        className={clsx(classes.card, faded && classes.faded)}
        data-kind={node.kind}
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
              <KindIcon kind={kindOf(element.id)} pattern={pattern} />
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
            {counted(rules, 'rule')}
          </span>
        )}
      </UnstyledButton>
      <Handle
        type="source"
        position={Position.Bottom}
        className={classes.handle}
      />
    </>
  );
}
