import { useId } from 'react';
import { Box } from '#/shared/design-system/box.tsx';
import { Checkbox } from '#/shared/design-system/checkbox.tsx';
import { Group } from '#/shared/design-system/group.tsx';
import { Text } from '#/shared/design-system/text.tsx';
import { UnstyledButton } from '#/shared/design-system/unstyled-button.tsx';
import { VisuallyHidden } from '#/shared/design-system/visually-hidden.tsx';
import {
  type ElementSection,
  groupLabelOf,
} from '../../system-model-exploration.ts';
import classes from './exploration.module.css';

/*
 * The kinds of element the exploration draws, each a checkbox, grouped by
 * modules, building blocks and behaviours, as the architecture's building
 * block filter groups its types.
 */
export function KindList({
  sections,
  hidden,
  onHide,
}: {
  sections: ElementSection[];
  hidden: ReadonlySet<string>;
  onHide: (hidden: ReadonlySet<string>) => void;
}) {
  const title = useId();
  const all = sections.flatMap(({ groups }) =>
    groups.map(({ group }) => group),
  );
  const hiddenHere = all.filter((group) => hidden.has(group));
  const set = (groups: string[], hide: boolean) => {
    const next = new Set(hidden);
    for (const group of groups)
      if (hide) next.add(group);
      else next.delete(group);
    onHide(next);
  };

  return (
    <Box component="section" pb={6} aria-labelledby={title}>
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
          Kinds
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
      {sections.map(({ title: section, groups }) => {
        const names = groups.map(({ group }) => group);
        const shown = names.filter((group) => !hidden.has(group));
        return (
          <fieldset key={section} className={classes.fieldset}>
            <VisuallyHidden component="legend">{section}</VisuallyHidden>
            <Checkbox
              className={classes.section}
              pt={6}
              px="sm"
              pb={4}
              size="xs"
              label={section}
              aria-label={`Every kind of ${section.toLowerCase()}`}
              checked={shown.length === names.length}
              indeterminate={shown.length > 0 && shown.length < names.length}
              onChange={() => set(names, shown.length === names.length)}
            />
            {groups.map(({ group, count }) => {
              const label = groupLabelOf(group);
              return (
                <Group
                  key={group}
                  wrap="nowrap"
                  gap={0}
                  pl={28}
                  pr={8}
                  className={classes.row}
                >
                  <Checkbox
                    classNames={{ labelWrapper: classes.grow }}
                    flex={1}
                    miw={0}
                    py={7}
                    size="xs"
                    label={
                      <Group component="span" wrap="nowrap" gap={8}>
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
                        </Text>
                      </Group>
                    }
                    checked={!hidden.has(group)}
                    onChange={(event) =>
                      set([group], !event.currentTarget.checked)
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
                      onHide(new Set(all.filter((each) => each !== group)))
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
    </Box>
  );
}
