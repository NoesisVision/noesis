import { Box } from '#/shared/design-system/box.tsx';
import { Group } from '#/shared/design-system/group.tsx';
import { UnstyledButton } from '#/shared/design-system/unstyled-button.tsx';
import { nameOf } from '../../element-id.ts';
import { DetailSection, DetailText } from './detail-parts.tsx';
import type { LaidOutNode } from './layout-architecture.ts';
import classes from './architecture-details.module.css';

/** The elements something is about, each a way to it; or a word on why there are none. */
export function ElementLinks({
  title,
  ids,
  cards,
  empty,
  onSelect,
}: {
  title: string;
  ids: string[];
  cards: ReadonlyMap<string, LaidOutNode>;
  empty?: string | undefined;
  onSelect: (id: string) => void;
}) {
  if (ids.length === 0 && empty === undefined) return null;
  return (
    <DetailSection title={title}>
      {ids.length === 0 ? (
        <DetailText>{empty}</DetailText>
      ) : (
        <Group component="ul" gap={6} m={0} p={0} className={classes.list}>
          {ids.map((id) => (
            <Box component="li" key={id}>
              <UnstyledButton
                className={classes.chip}
                py={2}
                px="xs"
                fz="sm"
                c="var(--mantine-color-anchor)"
                onClick={() => onSelect(id)}
              >
                {cards.get(id)?.label ?? nameOf(id)}
              </UnstyledButton>
            </Box>
          ))}
        </Group>
      )}
    </DetailSection>
  );
}
