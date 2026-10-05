import { IconChevronDown, IconFilter } from '@tabler/icons-react';
import { useId } from 'react';
import { KindIcon } from '#/features/design-docs/ui/model-tree/kind-icon.tsx';
import { patternLabelOf } from '#/features/design-docs/ui/model-tree/model-outline.ts';
import { plural } from '#/features/design-docs/ui/plural.ts';
import { Badge } from '#/shared/design-system/badge.tsx';
import { Button } from '#/shared/design-system/button.tsx';
import { Checkbox } from '#/shared/design-system/checkbox.tsx';
import { Group } from '#/shared/design-system/group.tsx';
import { Popover } from '#/shared/design-system/popover.tsx';
import { Text } from '#/shared/design-system/text.tsx';
import { UnstyledButton } from '#/shared/design-system/unstyled-button.tsx';
import { VisuallyHidden } from '#/shared/design-system/visually-hidden.tsx';
import type { TypeRing } from '../../building-block-types.ts';
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
  const title = useId();
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
            <Badge component="span" size="sm" ml={8} tt="none">
              {`${all.length - hiddenHere.length} of ${all.length}`}
            </Badge>
          )}
        </Button>
      </Popover.Target>
      <Popover.Dropdown p={0} w={300} aria-labelledby={title}>
        <Group
          justify="space-between"
          wrap="nowrap"
          gap={0}
          pt={6}
          px="sm"
          pb={8}
          fz="sm"
          fw={600}
          className={classes.head}
        >
          <Text component="span" inherit id={title}>
            Show building blocks
          </Text>
          <UnstyledButton
            className={classes.link}
            px={6}
            py={2}
            fz="xs"
            fw={600}
            disabled={hiddenHere.length === 0}
            onClick={() => set(all, false)}
          >
            Show all
          </UnstyledButton>
        </Group>
        {rings.map(({ ring, types }) => {
          const patterns = types.map(({ pattern }) => pattern);
          const shown = patterns.filter((pattern) => !hidden.has(pattern));
          return (
            <fieldset key={ring} className={classes.fieldset}>
              <VisuallyHidden component="legend">{ring}</VisuallyHidden>
              <Checkbox
                className={classes.ring}
                pt={6}
                px="sm"
                pb={4}
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
                  <Group
                    key={pattern}
                    wrap="nowrap"
                    gap={0}
                    pl={28}
                    pr={8}
                    className={classes.row}
                  >
                    <Checkbox
                      classNames={{
                        labelWrapper: classes.grow,
                        label: classes.block,
                      }}
                      flex={1}
                      miw={0}
                      py={7}
                      size="xs"
                      label={
                        <Group
                          component="span"
                          wrap="nowrap"
                          gap={8}
                          className={classes.label}
                        >
                          <KindIcon kind="building_block" pattern={pattern} />
                          {label}
                          <Text
                            component="span"
                            inherit
                            ml="auto"
                            fz="xs"
                            c="var(--noesis-secondary-text)"
                            className={classes.count}
                          >
                            {count}
                            <VisuallyHidden>
                              {` ${plural(count, 'card')}`}
                            </VisuallyHidden>
                          </Text>
                        </Group>
                      }
                      checked={!hidden.has(pattern)}
                      onChange={(event) =>
                        set([pattern], !event.currentTarget.checked)
                      }
                    />
                    <UnstyledButton
                      className={classes.only}
                      px={6}
                      py={2}
                      fz="xs"
                      fw={600}
                      aria-label={`Show only ${label}`}
                      onClick={() =>
                        onHide(new Set(all.filter((each) => each !== pattern)))
                      }
                    >
                      Only
                    </UnstyledButton>
                  </Group>
                );
              })}
            </fieldset>
          );
        })}
        <Text
          mt={6}
          pt={8}
          px="sm"
          pb={4}
          fz="xs"
          c="var(--noesis-secondary-text)"
          className={classes.foot}
        >
          Driving ports and who drives them always show.
        </Text>
      </Popover.Dropdown>
    </Popover>
  );
}
