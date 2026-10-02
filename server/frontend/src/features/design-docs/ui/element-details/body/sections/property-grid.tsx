import { Tooltip } from '#/shared/design-system/tooltip.tsx';
import { UnstyledButton } from '#/shared/design-system/unstyled-button.tsx';
import type { ChangeListItem } from '../../change-list-items.ts';
import { useElementNavigation } from '../../element-navigation.ts';
import { shortName } from './ref.tsx';
import classes from './property-grid.module.css';

/**
 * Properties as tiles, each a declaration: a glyph for what its type is —
 * `#` for a primitive, `→` for another building block — its name, its type,
 * and what the design says it holds.
 */
export function PropertyGrid({ items }: { items: ChangeListItem[] }) {
  return (
    <ul className={classes.grid}>
      {items.map(
        ({ change, label, name, type, reference, typePath, description }) => (
          <li key={`${change}:${label}`} className={classes.card}>
            <span
              className={classes.glyph}
              data-reference={reference || undefined}
              aria-hidden="true"
            >
              {reference ? '→' : '#'}
            </span>
            <span className={classes.body}>
              <code
                className={classes.name}
                data-removed={change === 'removed' || undefined}
              >
                {name ?? label}
              </code>
              {type !== undefined && <Type type={type} path={typePath} />}
              {description !== undefined && (
                <span className={classes.description}>{description}</span>
              )}
            </span>
          </li>
        ),
      )}
    </ul>
  );
}

/**
 * A type by its last segment, as the inputs and outputs read it, with its
 * address in full on hover. One that has a row in the tree opens it.
 */
function Type({ type, path }: { type: string; path: string | undefined }) {
  const { has, select } = useElementNavigation();
  const short = shortName(type).type;
  const pill =
    path !== undefined && has(path) ? (
      <UnstyledButton
        className={classes.type}
        data-link
        onClick={() => select(path)}
      >
        {short}
      </UnstyledButton>
    ) : (
      <code className={classes.type}>{short}</code>
    );
  return short === type ? (
    pill
  ) : (
    <Tooltip openDelay={300} label={type} position="right">
      {pill}
    </Tooltip>
  );
}
