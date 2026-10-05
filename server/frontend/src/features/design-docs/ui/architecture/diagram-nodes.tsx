import { Handle, type Node, type NodeProps, Position } from '@xyflow/react';
import { clsx } from 'clsx';
import { createContext, useContext } from 'react';
import { ChangeMark } from '#/features/design-docs/ui/model-tree/change-mark.tsx';
import { KindIcon } from '#/features/design-docs/ui/model-tree/kind-icon.tsx';
import {
  type OutlineChange,
  patternLabelOf,
} from '#/features/design-docs/ui/model-tree/model-outline.ts';
import { counted } from '#/features/design-docs/ui/plural.ts';
import { Box } from '#/shared/design-system/box.tsx';
import { Stack } from '#/shared/design-system/stack.tsx';
import { Text } from '#/shared/design-system/text.tsx';
import { UnstyledButton } from '#/shared/design-system/unstyled-button.tsx';
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
    <Box className={classes.frame} data-state={state}>
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
        // The dashed stroke of a related frame, said in words.
        aria-label={withState(
          `${node.label}, ${KINDS[node.kind].word} drawn as a hexagon`,
          state,
        )}
        onClick={() => onSelect(node.selects)}
      >
        <Text component="span" inherit fw={700}>
          {node.label}
        </Text>{' '}
        <Text component="span" inherit fz="xs" c="var(--noesis-secondary-text)">
          {KINDS[node.kind].word}
        </Text>
      </UnstyledButton>
    </Box>
  );
}

export function DomainCoreNode({
  data,
  width = 0,
  height = 0,
}: NodeProps<DiagramNode>) {
  return (
    <Box className={classes.frame}>
      <svg width={width} height={height} aria-hidden className={classes.core}>
        <polygon points={hexagonPoints(width, height, CORE_HEX_INSET)} />
      </svg>
      <Text
        component="span"
        className={classes.ringLabel}
        inherit
        fz={11}
        lts="0.06em"
        tt="uppercase"
      >
        {data.node.label}
      </Text>
    </Box>
  );
}

/** What a frame or card is to the selection, for a reader who cannot see its outline. */
const withState = (label: string, state: 'selected' | 'related' | undefined) =>
  state === 'related' ? `${label}, concerned by the selection` : label;

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
        aria-label={withState(label, state)}
        title={label}
        onClick={() => onSelect(node.selects)}
      >
        {element !== null && (
          <Box component="span" display="inline-flex" flex="none">
            <ChangeMark change={change} color={changeColour}>
              <KindIcon kind={kindOf(element.id)} pattern={pattern} />
            </ChangeMark>
          </Box>
        )}
        <Stack component="span" gap={0} miw={0} lh={1.2}>
          <Text
            component="span"
            inherit
            fz="sm"
            fw={700}
            truncate
            className={classes.name}
          >
            {node.label}
          </Text>
          {subtitle !== null && (
            <Text component="span" inherit fz="xs" className={classes.subtitle}>
              {subtitle}
            </Text>
          )}
        </Stack>
        {(warnings > 0 || notes > 0) && (
          <Box
            component="span"
            className={classes.marker}
            data-level={warnings > 0 ? 'warning' : 'note'}
            fz={13}
            fw={700}
            aria-hidden
          >
            {warnings > 0 ? '!' : 'i'}
          </Box>
        )}
        {rules !== null && (
          <Box
            component="span"
            className={classes.ruleCount}
            px={6}
            fz={11}
            lh="16px"
            aria-hidden
          >
            {counted(rules, 'rule')}
          </Box>
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
