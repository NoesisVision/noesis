import { type KeyboardEvent, memo, type MouseEvent } from 'react';
import { ChangeMark } from './change-mark.tsx';
import { Chevron } from './chevron.tsx';
import { DiagramMark } from './diagram-mark.tsx';
import { KindIcon } from './kind-icon.tsx';
import { MatchedText } from './matched-text.tsx';
import type { OutlineNode } from './model-outline.ts';
import { focusEdge, focusParent, focusSibling } from './row-focus.ts';
import { useTreeActions, useTreeState } from './tree-store.ts';
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
}

/*
 * Given nothing but its node, so that a row renders again only when what it
 * reads of the tree's state has changed, never because the tree around it
 * did.
 */
export const TreeItem = memo(function TreeItem({ node }: TreeItemProps) {
  const path = node.path;
  const { select, toggle, expand, collapse } = useTreeActions();
  const children = useTreeState((s) => s.childrenOf(path));
  const hasChildren = children.length > 0;
  const expanded = useTreeState((s) => hasChildren && s.isExpanded(path));
  const selected = useTreeState((s) => s.selected === path);
  const inPath = useTreeState((s) => s.ancestry.has(path));
  const focusable = useTreeState((s) => s.focusPath === path);
  const context = useTreeState(
    (s) => s.matched !== null && !s.matched.has(path),
  );
  const tokens = useTreeState((s) => s.tokens);
  const rowId = useTreeState((s) => s.rowIds.get(path));
  const colour = useTreeState((s) => s.colours[node.change]);

  // A pointer event lands on every row it is inside; only the innermost
  // meant it.
  const onClick = (event: MouseEvent<HTMLLIElement>) => {
    event.stopPropagation();
    select(node.path, 'tree');
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
        return select(node.path, 'tree');
      default:
    }
  };

  return (
    <li
      role="treeitem"
      aria-level={node.depth + 1}
      aria-selected={selected}
      aria-expanded={hasChildren ? expanded : undefined}
      aria-labelledby={rowId}
      tabIndex={focusable ? 0 : -1}
      data-path={node.path}
      data-depth={node.depth}
      data-kind={node.kind}
      data-change={node.change}
      data-selected={selected || undefined}
      data-ancestor={(!selected && inPath) || undefined}
      data-context={context || undefined}
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
        <ChangeMark change={node.change} color={colour}>
          <KindIcon kind={node.kind} pattern={node.pattern} />
        </ChangeMark>
        <MatchedText className={classes.name} tokens={tokens}>
          {node.name}
        </MatchedText>
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
          data-in-path={inPath || undefined}
        >
          {children.map((child) => (
            <TreeItem key={child.path} node={child} />
          ))}
        </ul>
      )}
    </li>
  );
});
