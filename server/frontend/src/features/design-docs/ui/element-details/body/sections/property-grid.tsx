import { Grid } from '#/shared/design-system/grid.tsx';
import { Spoiler } from '#/shared/design-system/spoiler.tsx';
import { Tooltip } from '#/shared/design-system/tooltip.tsx';
import { UnstyledButton } from '#/shared/design-system/unstyled-button.tsx';
import type { ChangeListItem } from '../../change-list-items.ts';
import { useElementNavigation } from '../../element-navigation.ts';
import { shortName } from './ref.tsx';
import classes from './property-grid.module.css';

/** Three lines of a description, at its 13px and 1.45 line height. */
const DESCRIPTION_HEIGHT = Math.ceil(13 * 1.45 * 2);

// Mantine asks for all five; past `md` the four columns hold.
const BREAKPOINTS = {
  xs: '440px',
  sm: '660px',
  md: '880px',
  lg: '1100px',
  xl: '1320px',
};
const SPAN = { base: 12, xs: 6, sm: 4, md: 3 };

/**
 * Properties as tiles, each a declaration: a glyph for what its type is —
 * `#` for a primitive, `→` for another building block — its name, its type,
 * and what the design says it holds — three lines of it, the rest a click away.
 */
export function PropertyGrid({ items }: { items: ChangeListItem[] }) {
  return (
    // Container breakpoints: the columns follow the panel, not the window,
    // keeping each card about 200px wide as the panel grows.
    <Grid type="container" breakpoints={BREAKPOINTS} gap={10}>
      {items.map(
        ({ change, label, name, type, reference, typePath, description }) => (
          <Grid.Col key={`${change}:${label}`} span={SPAN}>
            <div className={classes.card}>
              <span
                className={classes.glyph}
                data-reference={reference || undefined}
                aria-hidden="true"
              >
                {reference ? '→' : '#'}
              </span>
              <div className={classes.body}>
                <code
                  className={classes.name}
                  data-removed={change === 'removed' || undefined}
                >
                  {name ?? label}
                </code>
                {type !== undefined && <Type type={type} path={typePath} />}
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
            </div>
          </Grid.Col>
        ),
      )}
    </Grid>
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
