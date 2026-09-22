import type { ReactNode } from 'react';
import { Box } from '#/shared/design-system/box.tsx';
import { Grid } from '#/shared/design-system/grid.tsx';
import { Text } from '#/shared/design-system/text.tsx';
import { Title } from '#/shared/design-system/title.tsx';

interface OverviewSectionItem {
  id: string;
  /**
   * The card itself, built by the caller: only it knows which route the item
   * opens, and a route is checked against the tree where it is written.
   */
  card: ReactNode;
}

interface OverviewSectionProps {
  title: string;
  items: OverviewSectionItem[];
  /** Shown in place of the cards: loading, a failure, or nothing there yet. */
  empty?: ReactNode;
  mt?: number;
}

export function OverviewSection({
  title,
  mt,
  items,
  empty = 'No items',
}: OverviewSectionProps) {
  return (
    <Box mt={mt}>
      <Title order={2} size="h3" mb={8}>
        {title}
      </Title>
      <Grid>
        {items.map((item) => (
          <Grid.Col key={item.id} span={{ base: 12, md: 6, lg: 4 }}>
            {item.card}
          </Grid.Col>
        ))}
        {!items.length && <Text>{empty}</Text>}
      </Grid>
    </Box>
  );
}
