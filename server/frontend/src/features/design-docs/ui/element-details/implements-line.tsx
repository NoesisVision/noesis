import { Fragment } from 'react';
import { UnstyledButton } from '#/shared/design-system/unstyled-button.tsx';
import { QualifiedName, shortName } from '#/shared/ui/qualified-name.tsx';
import { RemoveButton } from '../unit-editor/unit-actions.tsx';
import type { ChangeListItem } from './change-list-items.ts';
import { useElementNavigation } from './element-navigation.ts';
import { ElementTooltip } from './element-tooltip.tsx';
import classes from './element-detail.module.css';

/**
 * What a building block implements, read after its name the way it is
 * declared: `implements DraftEvent, Auditable`. Each type by its last
 * segment, its address on hover, opening its row when the tree has one; one
 * the design removes is struck through.
 */
export function ImplementsLine({
  items,
  block,
}: {
  items: ChangeListItem[];
  /** The block that implements them, which a write from the line names. */
  block: string | null;
}) {
  const { has, select } = useElementNavigation();
  if (items.length === 0) return null;
  const sorted = [...items].sort((a, b) =>
    shortName(a.label).type.localeCompare(shortName(b.label).type),
  );
  return (
    <span className={classes.implements}>
      {'implements '}
      {sorted.map(({ change, label, path }, index) => {
        const removed = change === 'removed' || undefined;
        return (
          <Fragment key={`${change}:${label}`}>
            {index > 0 && ', '}
            <span className={classes.implemented}>
              <ElementTooltip name={label}>
                {path !== null && has(path) ? (
                  <UnstyledButton
                    className={classes.type}
                    data-link
                    data-removed={removed}
                    onClick={() => select(path)}
                  >
                    <QualifiedName name={label} />
                  </UnstyledButton>
                ) : (
                  <span className={classes.type} data-removed={removed}>
                    <QualifiedName name={label} />
                  </span>
                )}
              </ElementTooltip>
              {block !== null && path !== null && (
                <RemoveButton
                  className={classes.remove}
                  unit={{
                    kind: 'implements',
                    id: path,
                    owner: { kind: 'building_block', id: block },
                  }}
                />
              )}
            </span>
          </Fragment>
        );
      })}
    </span>
  );
}
