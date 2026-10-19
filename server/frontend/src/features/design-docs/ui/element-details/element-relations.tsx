import { useState } from 'react';
import { KindIcon } from '#/features/design-docs/ui/model-tree/kind-icon.tsx';
import type { OutlineNode } from '#/features/design-docs/ui/model-tree/model-outline.ts';
import type { OutlineTree } from '#/features/design-docs/ui/model-tree/outline-tree.ts';
import { Anchor } from '#/shared/design-system/anchor.tsx';
import { Text } from '#/shared/design-system/text.tsx';
import { QualifiedName, shortName } from '#/shared/ui/qualified-name.tsx';
import type { ChangeListItem } from './change-list-items.ts';
import { useElementNavigation } from './element-navigation.ts';
import { ElementTooltip } from './element-tooltip.tsx';
import classes from './element-relations.module.css';

/** As many types as a relation names before it offers the rest. */
const NAMED = 8;

/** One type a block is tied to, and the row it stands for when the tree has it. */
interface Related {
  item: ChangeListItem;
  node: OutlineNode | undefined;
}

/**
 * What a building block implements and what implements it, over its
 * definition, in a box of their own: a label and a count on the left, the
 * types after it as links, in the order of their names. Nothing at all when
 * the block has neither.
 */
export function ElementRelations({
  implemented,
  implementers,
  tree,
}: {
  implemented: ChangeListItem[];
  implementers: ChangeListItem[];
  /** Where a type finds its row, and so its kind. */
  tree: OutlineTree;
}) {
  if (implemented.length === 0 && implementers.length === 0) return null;
  const relate = (items: ChangeListItem[]): Related[] =>
    [...items]
      .sort((a, b) =>
        shortName(a.label).type.localeCompare(shortName(b.label).type),
      )
      .map((item) => ({
        item,
        node: item.path === null ? undefined : tree.byPath.get(item.path),
      }));
  return (
    <div className={classes.relations}>
      <dl className={classes.list}>
        <Relation label="Implements" related={relate(implemented)} />
        <Relation label="Implemented by" related={relate(implementers)} />
      </dl>
    </div>
  );
}

/** One relation: its label and count, then its types. */
function Relation({ label, related }: { label: string; related: Related[] }) {
  const [open, setOpen] = useState(false);
  if (related.length === 0) return null;
  return (
    <div className={classes.relation}>
      <dt className={classes.label}>
        <Text span size="sm" c="dimmed">
          {label}
        </Text>{' '}
        <Text span size="sm" c="dimmed" fw={600}>
          {related.length}
        </Text>
      </dt>
      <dd className={classes.types}>
        <ul className={classes.links}>
          {(open ? related : related.slice(0, NAMED)).map(({ item, node }) => (
            <li key={`${item.change}:${item.label}`} className={classes.link}>
              {node !== undefined && (
                <KindIcon kind={node.kind} pattern={node.pattern} size={14} />
              )}
              <TypeLink item={item} />
            </li>
          ))}
          {related.length > NAMED && (
            <li className={classes.link}>
              <Anchor
                component="button"
                size="sm"
                c="dimmed"
                onClick={() => setOpen(!open)}
              >
                {open ? 'Show less' : `+${related.length - NAMED} more`}
              </Anchor>
            </li>
          )}
        </ul>
      </dd>
    </div>
  );
}

/**
 * A type by its last segment, its address on hover, opening its row when the
 * tree has one; one the design removes is struck through.
 */
function TypeLink({ item }: { item: ChangeListItem }) {
  const { has, select } = useElementNavigation();
  const { change, label, path } = item;
  const td = change === 'removed' ? 'line-through' : undefined;
  const removed = change === 'removed' || undefined;
  return (
    <ElementTooltip name={label}>
      {path !== null && has(path) ? (
        <Anchor
          component="button"
          size="sm"
          fw={500}
          td={td}
          data-removed={removed}
          onClick={() => select(path)}
        >
          <QualifiedName name={label} />
        </Anchor>
      ) : (
        <Text span size="sm" fw={500} td={td} data-removed={removed}>
          <QualifiedName name={label} />
        </Text>
      )}
    </ElementTooltip>
  );
}
