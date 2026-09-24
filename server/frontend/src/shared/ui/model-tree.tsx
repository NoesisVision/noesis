import {
  IconBolt,
  IconChartDots3,
  IconCube,
  IconFolder,
  IconListCheck,
  IconPoint,
  IconScale,
} from '@tabler/icons-react';
import {
  type KeyboardEvent,
  type MouseEvent,
  useEffect,
  useId,
  useMemo,
  useRef,
} from 'react';
import { Badge } from '#/shared/design-system/badge.tsx';
import { Highlight } from '#/shared/design-system/highlight.tsx';
import { Text } from '#/shared/design-system/text.tsx';
import { VisuallyHidden } from '#/shared/design-system/visually-hidden.tsx';
import type {
  OutlineChange,
  OutlineKind,
  OutlineNode,
} from '#backend/app/model-outline/model-outline.ts';
import { CHANGE_COLOUR } from './outline-change.ts';
import type { ModelTreeController } from './use-model-tree.ts';
import classes from './model-tree.module.css';

/*
 * A model as a tree: contexts, the modules under them, the building blocks
 * under those, and what each block is made of. The same component draws a
 * design document's outline and, in time, the scanned model's — it is given
 * nodes and a controller and knows nothing of either.
 *
 * A row is one hit area and one tab stop: the whole row opens and selects,
 * because a chevron of its own inside a `treeitem` would be a control inside
 * a control. Arrow keys do what the tree pattern says they do.
 */

export interface ModelTreeProps {
  controller: ModelTreeController;
  /** What the tree is of, for a reader who arrives at it by keyboard. */
  label: string;
}

export function ModelTree({ controller, label }: ModelTreeProps) {
  const baseId = useId();
  const { tree, selected } = controller;

  const rowIds = useMemo(
    () =>
      new Map(
        tree.nodes.map((node, index) => [node.path, `${baseId}-${index}`]),
      ),
    [tree, baseId],
  );
  // The line from the top down to the selected row, so its rails can be lit.
  const ancestry = useMemo(
    () => new Set(selected === null ? [] : tree.ancestryOf(selected)),
    [tree, selected],
  );
  const roots = tree.roots.filter((node) => controller.isVisible(node.path));
  const focusPath = selected ?? roots[0]?.path ?? null;
  const list = useRef<HTMLUListElement>(null);

  /*
   * The tree follows the reader wherever the choice was made — a step of the
   * breadcrumb, a link into the middle of a design — so the row they are
   * reading is a row they can see. `nearest` means a row already on screen is
   * left where it is, and how the scroll is made is the stylesheet's to say,
   * which is how a reader who asked for no motion is given none.
   */
  useEffect(() => {
    if (selected === null) return;
    const rows = list.current?.querySelectorAll<HTMLElement>('[data-path]');
    for (const row of rows ?? []) {
      if (row.dataset.path === selected) {
        row.scrollIntoView({ block: 'nearest' });
        return;
      }
    }
  }, [selected]);

  return (
    <ul ref={list} role="tree" aria-label={label} className={classes.tree}>
      {roots.map((node) => (
        <ModelTreeItem
          key={node.path}
          node={node}
          controller={controller}
          rowIds={rowIds}
          ancestry={ancestry}
          focusPath={focusPath}
        />
      ))}
    </ul>
  );
}

interface ItemProps {
  node: OutlineNode;
  controller: ModelTreeController;
  rowIds: ReadonlyMap<string, string>;
  ancestry: ReadonlySet<string>;
  focusPath: string | null;
}

function ModelTreeItem({
  node,
  controller,
  rowIds,
  ancestry,
  focusPath,
}: ItemProps) {
  const {
    tree,
    selected,
    search,
    isVisible,
    isExpanded,
    open,
    select,
    expand,
    collapse,
  } = controller;
  const children = tree
    .childrenOf(node.path)
    .filter((child) => isVisible(child.path));
  const hasChildren = children.length > 0;
  const expanded = hasChildren && isExpanded(node.path);
  const rowId = rowIds.get(node.path);

  const onClick = (event: MouseEvent<HTMLLIElement>) => {
    // A click lands on every row it is inside; only the innermost meant it.
    event.stopPropagation();
    open(node.path);
  };

  const onKeyDown = (event: KeyboardEvent<HTMLLIElement>) => {
    const row = event.currentTarget;
    const handled = () => {
      event.preventDefault();
      event.stopPropagation();
    };

    switch (event.key) {
      case 'ArrowDown':
        handled();
        return focusSibling(row, 1);
      case 'ArrowUp':
        handled();
        return focusSibling(row, -1);
      case 'ArrowRight':
        handled();
        if (hasChildren && !expanded) return expand(node.path);
        if (expanded) return focusSibling(row, 1);
        return;
      case 'ArrowLeft':
        handled();
        if (expanded) return collapse(node.path);
        return focusParent(row);
      case 'Home':
        handled();
        return focusEdge(row, 'first');
      case 'End':
        handled();
        return focusEdge(row, 'last');
      case 'Enter':
      case ' ':
        handled();
        return select(node.path);
      default:
    }
  };

  return (
    <li
      role="treeitem"
      aria-level={node.depth + 1}
      aria-selected={selected === node.path}
      aria-expanded={hasChildren ? expanded : undefined}
      aria-labelledby={rowId}
      tabIndex={focusPath === node.path ? 0 : -1}
      data-path={node.path}
      data-depth={node.depth}
      data-kind={node.kind}
      data-change={node.change}
      data-selected={selected === node.path || undefined}
      data-ancestor={
        (selected !== node.path && ancestry.has(node.path)) || undefined
      }
      data-context={
        (search.active && !search.matched.has(node.path)) || undefined
      }
      className={classes.item}
      onClick={onClick}
      onKeyDown={onKeyDown}
    >
      <span id={rowId} className={classes.row}>
        <KindIcon kind={node.kind} />
        <Marked className={classes.name} tokens={search.tokens}>
          {node.name}
        </Marked>
        {node.patternLabel !== null && (
          <Marked className={classes.pattern} tokens={search.tokens} dimmed>
            {node.patternLabel}
          </Marked>
        )}
        <span className={classes.trailing}>
          {node.hasDiagram && (
            <span className={classes.mark}>
              <IconChartDots3 size={14} stroke={1.6} aria-hidden />
              <VisuallyHidden>has a diagram</VisuallyHidden>
            </span>
          )}
          <ChangeBadge change={node.change} />
        </span>
      </span>
      {expanded && (
        <ul
          // The tree pattern owns its subtrees through this role; none of the
          // tags the rule suggests is a tree, and any of them would break the
          // relation a reader navigates by.
          // oxlint-disable-next-line jsx-a11y/prefer-tag-over-role
          role="group"
          className={classes.group}
          data-in-path={ancestry.has(node.path) || undefined}
        >
          {children.map((child) => (
            <ModelTreeItem
              key={child.path}
              node={child}
              controller={controller}
              rowIds={rowIds}
              ancestry={ancestry}
              focusPath={focusPath}
            />
          ))}
        </ul>
      )}
    </li>
  );
}

/**
 * What the query found, marked in the row that holds it. `<mark>` says it in
 * the markup rather than only in a colour, so it survives a reader who cannot
 * see the colour and a test that cannot see the CSS.
 */
function Marked({
  tokens,
  className,
  dimmed,
  children,
}: {
  tokens: readonly string[];
  className: string;
  dimmed?: boolean;
  children: string;
}) {
  const colour = dimmed ? 'dimmed' : undefined;
  // A monospaced face reads a size larger at the same measure.
  const size = dimmed ? 'xs' : 'sm';
  if (tokens.length === 0) {
    return (
      <Text component="span" size={size} c={colour} className={className}>
        {children}
      </Text>
    );
  }
  return (
    <Highlight
      component="span"
      size={size}
      c={colour}
      className={className}
      highlight={[...tokens]}
    >
      {children}
    </Highlight>
  );
}

/** The colour says it at a glance; the word says it at all. */
function ChangeBadge({ change }: { change: OutlineChange }) {
  const colour = CHANGE_COLOUR[change];
  if (colour === null) return null;
  return (
    <Badge size="xs" color={colour} variant="light">
      {change}
    </Badge>
  );
}

const KIND_ICONS = {
  module: IconFolder,
  building_block: IconCube,
  behaviour: IconBolt,
  property: IconPoint,
  rule: IconScale,
  scenario: IconListCheck,
} as const satisfies Record<OutlineKind, unknown>;

function KindIcon({ kind }: { kind: OutlineKind }) {
  const Icon = KIND_ICONS[kind];
  return <Icon size={16} stroke={1.6} className={classes.icon} aria-hidden />;
}

/*
 * A collapsed subtree is not rendered at all, so every row in the document is
 * a row the reader can see and the order they are in is the order to move in.
 */
function rowsAround(row: HTMLElement): HTMLElement[] {
  const root = row.closest('[role="tree"]');
  return root === null
    ? [row]
    : [...root.querySelectorAll<HTMLElement>('[role="treeitem"]')];
}

function focusSibling(row: HTMLElement, step: number): void {
  const rows = rowsAround(row);
  rows[rows.indexOf(row) + step]?.focus();
}

function focusEdge(row: HTMLElement, edge: 'first' | 'last'): void {
  const rows = rowsAround(row);
  (edge === 'first' ? rows[0] : rows.at(-1))?.focus();
}

function focusParent(row: HTMLElement): void {
  row.parentElement?.closest<HTMLElement>('[role="treeitem"]')?.focus();
}
