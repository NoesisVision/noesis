import { Handle, type Node, type NodeProps, Position } from '@xyflow/react';
import { UnstyledButton } from '#/shared/design-system/unstyled-button.tsx';
import { ChangeMark } from '#/shared/ui/model-tree/change-mark.tsx';
import { KindIcon } from '#/shared/ui/model-tree/kind-icon.tsx';
import {
  type OutlineChange,
  patternLabelOf,
} from '#/shared/ui/model-tree/model-outline.ts';
import { counted } from '#/shared/ui/plural.ts';
import { kindOf } from '../../element-id.ts';
import { KINDS } from './architecture-kinds.ts';
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

export type DiagramNode = Node<CardData>;

export function HexagonNode({
  data,
  width = 0,
  height = 0,
}: NodeProps<DiagramNode>) {
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
        className={classes.card}
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
