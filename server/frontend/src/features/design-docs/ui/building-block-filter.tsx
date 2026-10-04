import { IconChevronDown, IconFilter } from '@tabler/icons-react';
import { Badge } from '#/shared/design-system/badge.tsx';
import { Button } from '#/shared/design-system/button.tsx';
import { Checkbox } from '#/shared/design-system/checkbox.tsx';
import { Popover } from '#/shared/design-system/popover.tsx';
import { UnstyledButton } from '#/shared/design-system/unstyled-button.tsx';
import { VisuallyHidden } from '#/shared/design-system/visually-hidden.tsx';
import { KindIcon } from '#/shared/ui/model-tree/kind-icon.tsx';
import { patternLabelOf } from '#/shared/ui/model-tree/model-outline.ts';
import type { TypeRing } from '../building-block-types.ts';
import classes from './building-block-filter.module.css';

/*
 * The building block types the hexagons draw, each a checkbox, grouped by the
 * ring they sit in. The dropdown is the one place to change them; the
 * button says how many types show.
 */
export function BuildingBlockFilter({
  rings,
  hidden,
  onHide,
}: {
  rings: TypeRing[];
  hidden: ReadonlySet<string>;
  onHide: (hidden: ReadonlySet<string>) => void;
}) {
  const all = rings.flatMap(({ types }) => types.map(({ pattern }) => pattern));
  const hiddenHere = all.filter((pattern) => hidden.has(pattern));
  const set = (patterns: string[], hide: boolean) => {
    const next = new Set(hidden);
    for (const pattern of patterns)
      if (hide) next.add(pattern);
      else next.delete(pattern);
    onHide(next);
  };

  return (
    <Popover position="bottom-end" shadow="md" trapFocus>
      <Popover.Target>
        <Button
          variant={hiddenHere.length > 0 ? 'light' : 'default'}
          size="xs"
          leftSection={<IconFilter size={16} stroke={1.6} aria-hidden />}
          rightSection={<IconChevronDown size={16} stroke={1.6} aria-hidden />}
          disabled={all.length === 0}
        >
          Building blocks
          {hiddenHere.length > 0 && (
            <Badge size="sm" ml={8} tt="none">
              {`${all.length - hiddenHere.length} of ${all.length}`}
            </Badge>
          )}
        </Button>
      </Popover.Target>
      <Popover.Dropdown
        p={0}
        className={classes.dropdown}
        aria-labelledby="building-block-filter-title"
      >
        <div className={classes.head}>
          <span id="building-block-filter-title">Show building blocks</span>
          <UnstyledButton
            className={classes.link}
            disabled={hiddenHere.length === 0}
            onClick={() => set(all, false)}
          >
            Show all
          </UnstyledButton>
        </div>
        {rings.map(({ ring, types }) => {
          const patterns = types.map(({ pattern }) => pattern);
          const shown = patterns.filter((pattern) => !hidden.has(pattern));
          return (
            <fieldset key={ring} className={classes.fieldset}>
              <VisuallyHidden component="legend">{ring}</VisuallyHidden>
              <Checkbox
                className={classes.ring}
                size="xs"
                label={ring}
                aria-label={`Every type in ${ring.toLowerCase()}`}
                checked={shown.length === patterns.length}
                indeterminate={
                  shown.length > 0 && shown.length < patterns.length
                }
                onChange={() => set(patterns, shown.length === patterns.length)}
              />
              {types.map(({ pattern, count }) => {
                const label = patternLabelOf(pattern);
                return (
                  <div key={pattern} className={classes.row}>
                    <Checkbox
                      classNames={{
                        root: classes.type,
                        labelWrapper: classes.grow,
                        label: classes.block,
                      }}
                      size="xs"
                      label={
                        <span className={classes.label}>
                          <KindIcon kind="building_block" pattern={pattern} />
                          {label}
                          <span className={classes.count}>
                            {count}
                            <VisuallyHidden>
                              {count === 1 ? ' card' : ' cards'}
                            </VisuallyHidden>
                          </span>
                        </span>
                      }
                      checked={!hidden.has(pattern)}
                      onChange={(event) =>
                        set([pattern], !event.currentTarget.checked)
                      }
                    />
                    <UnstyledButton
                      className={classes.only}
                      aria-label={`Show only ${label}`}
                      onClick={() =>
                        onHide(new Set(all.filter((each) => each !== pattern)))
                      }
                    >
                      Only
                    </UnstyledButton>
                  </div>
                );
              })}
            </fieldset>
          );
        })}
        <p className={classes.foot}>
          Driving ports and who drives them always show.
        </p>
      </Popover.Dropdown>
    </Popover>
  );
}
