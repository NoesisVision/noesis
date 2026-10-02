import type { ReactElement } from 'react';
import { Badge } from '#/shared/design-system/badge.tsx';
import { Card } from '#/shared/design-system/card.tsx';
import { Group } from '#/shared/design-system/group.tsx';
import { Spoiler } from '#/shared/design-system/spoiler.tsx';
import { QualifiedName } from '#/shared/ui/qualified-name.tsx';
import type { ChangeListItem } from '../../change-list-items.ts';
import { useElementNavigation } from '../../element-navigation.ts';
import { ElementTooltip } from '../../element-tooltip.tsx';
import classes from './property-card.module.css';

/** Two lines of a description, at its 13px and 1.45 line height. */
const DESCRIPTION_HEIGHT = Math.ceil(13 * 1.45 * 2);

/**
 * One property as a tile, a declaration: a glyph for what its type is — `#`
 * for a primitive, `→` for another building block — its name, its type, and
 * what the design says it holds, folded past two lines. Hovering anywhere on
 * it says what its type is.
 */
export function PropertyCard({ item }: { item: ChangeListItem }) {
  const { change, label, name, type, reference, typePath, description } = item;
  return (
    <TypeTooltip type={type}>
      <Card h="100%">
        <Group gap={8}>
          <span
            className={classes.glyph}
            data-reference={reference || undefined}
            aria-hidden="true"
          >
            {reference ? '→' : '#'}
          </span>
          <code
            className={classes.name}
            data-removed={change === 'removed' || undefined}
          >
            {name ?? label}
          </code>
          {type !== undefined && <Type type={type} path={typePath} />}
        </Group>
        <div className={classes.body}>
          {description !== undefined && (
            <Spoiler
              maxHeight={DESCRIPTION_HEIGHT}
              showLabel="Show more"
              hideLabel="Show less"
              classNames={{ control: classes.more }}
            >
              <span className={classes.description}>{description}</span>
            </Spoiler>
          )}
        </div>
      </Card>
    </TypeTooltip>
  );
}

/** The whole card says what its type is, not only the pill that names it. */
function TypeTooltip({
  type,
  children,
}: {
  type: string | undefined;
  children: ReactElement;
}) {
  return type === undefined ? (
    children
  ) : (
    <ElementTooltip name={type}>{children}</ElementTooltip>
  );
}

/**
 * A type by its last segment, as the inputs and outputs read it, on the same
 * badge the panel marks a change with. One that has a row in the tree opens it.
 */
function Type({ type, path }: { type: string; path: string | undefined }) {
  const { has, select } = useElementNavigation();
  const linked = path !== undefined && has(path);
  const badge = {
    variant: 'light',
    size: 'xs',
    tt: 'none',
    ff: 'monospace',
    className: classes.type,
  } as const;
  return linked ? (
    <Badge
      {...badge}
      component="button"
      type="button"
      data-link
      onClick={() => select(path)}
    >
      <QualifiedName name={type} />
    </Badge>
  ) : (
    <Badge {...badge}>
      <QualifiedName name={type} />
    </Badge>
  );
}
