import { Children, type ReactNode } from 'react';
import { Box } from '#/shared/design-system/box.tsx';
import { Group } from '#/shared/design-system/group.tsx';
import { Text } from '#/shared/design-system/text.tsx';
import { Title } from '#/shared/design-system/title.tsx';
import type { IconComponent } from '#/shared/ui/icon-heading.tsx';
import classes from './overview.module.css';

interface OverviewSectionProps {
  title: string;
  /** The icon of the kind the section lists. */
  icon: IconComponent;
  /** How many it holds; none until the list is in. */
  count: number | undefined;
  /** Shown in place of the tiles: loading, or nothing there yet. */
  empty: ReactNode;
  /** The tiles, each built by the caller: only it knows the route it opens. */
  children: ReactNode;
}

/** A part of a change's overview: its kind by name and count, then its tiles. */
export function OverviewSection({
  title,
  icon: Icon,
  count,
  empty,
  children,
}: OverviewSectionProps) {
  const tiles = Children.toArray(children);
  return (
    <Box component="section" className={classes.section}>
      <Group gap="sm" wrap="nowrap">
        <Icon size={18} stroke={1.6} aria-hidden />
        <Title order={2} className={classes.sectionTitle}>
          {title}
        </Title>
        {count !== undefined && (
          <Text span size="sm" c="dimmed">
            {count}
          </Text>
        )}
      </Group>
      {tiles.length > 0 ? (
        <Box className={classes.tiles}>{tiles}</Box>
      ) : (
        <Text c="dimmed" size="sm">
          {empty}
        </Text>
      )}
    </Box>
  );
}
