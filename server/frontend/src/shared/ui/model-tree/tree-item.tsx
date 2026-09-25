import type { KeyboardEvent, MouseEvent } from 'react';
import type { OutlineNode } from '#backend/app/model-outline/model-outline.ts';
import { Chevron } from './chevron.tsx';
import { DiagramMark } from './diagram-mark.tsx';
import { KindIcon } from './kind-icon.tsx';
import { MatchedText } from './matched-text.tsx';
import { focusEdge, focusParent, focusSibling } from './row-focus.ts';
import type { ModelTreeController } from './use-model-tree.ts';
import classes from './model-tree.module.css';

/*
 * One row of the tree and, when it is open, everything under it.
 *
 * A click reads the row; a double click, or a click on the chevron beside the
 * name, opens or shuts it. One tab stop per row either way, and the arrow
 * keys do what the tree pattern says they do.
 */

export interface TreeItemProps {
  node: OutlineNode;
  controller: ModelTreeController;
  /** What names each row, so a `treeitem` is labelled by its own line alone. */
  rowIds: ReadonlyMap<string, string>;
  /** The line down to the row in hand, which lights the rails along it. */
  ancestry: ReadonlySet<string>;
  /** The one row of the tree that is in the page's tab order. */
  focusPath: string | null;
}

export function TreeItem({
  node,
  controller,
  rowIds,
  ancestry,
  focusPath,
}: TreeItemProps) {
  const {
    tree,
    selected,
    search,
    isVisible,
    isExpanded,
    select,
    toggle,
    expand,
    collapse,
  } = controller;
  const children = tree
    .childrenOf(node.path)
    .filter((child) => isVisible(child.path));
  const hasChildren = children.length > 0;
  const expanded = hasChildren && isExpanded(node.path);
  const rowId = rowIds.get(node.path);

  // A pointer event lands on every row it is inside; only the innermost
  // meant it.
  const onClick = (event: MouseEvent<HTMLLIElement>) => {
    event.stopPropagation();
    select(node.path);
  };

  const onDoubleClick = (event: MouseEvent<HTMLLIElement>) => {
    event.stopPropagation();
    toggle(node.path);
  };

  /* The chevron only opens and shuts; reading is the row's own job. */
  const onChevronClick = (event: MouseEvent<HTMLSpanElement>) => {
    event.stopPropagation();
    toggle(node.path);
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
      onDoubleClick={onDoubleClick}
      onKeyDown={onKeyDown}
    >
      {/* The one line of the row: what the tree scrolls to, never the item
          around it, which holds everything below it as well. */}
      <span id={rowId} data-row className={classes.row}>
        <Chevron
          opens={hasChildren}
          expanded={expanded}
          onToggle={onChevronClick}
        />
        <KindIcon kind={node.kind} />
        <MatchedText className={classes.name} tokens={search.tokens}>
          {node.name}
        </MatchedText>
        {node.patternLabel !== null && (
          <MatchedText
            className={classes.pattern}
            tokens={search.tokens}
            dimmed
          >
            {node.patternLabel}
          </MatchedText>
        )}
        <span className={classes.trailing}>
          {node.hasDiagram && <DiagramMark />}
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
            <TreeItem
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
