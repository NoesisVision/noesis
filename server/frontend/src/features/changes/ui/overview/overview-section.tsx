import type { ReactNode } from 'react';
import { Box } from '#/shared/design-system/box.tsx';
import { Card } from '#/shared/design-system/card.tsx';
import { Grid } from '#/shared/design-system/grid.tsx';
import { Text } from '#/shared/design-system/text.tsx';
import { Title } from '#/shared/design-system/title.tsx';

interface OverviewSectionItem {
  id: string;
  title: ReactNode;
  content?: ReactNode;
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
      <Title order={3} mb={8}>
        {title}
      </Title>
      <Grid>
        {items.map((item) => {
          return (
            <Grid.Col key={item.id} span={{ base: 12, md: 6, lg: 4 }}>
              <Card padding="lg" radius="md" withBorder>
                <Title order={4} mb={8}>
                  {item.title}
                </Title>
                <Text size="sm">{item.content}</Text>
              </Card>
            </Grid.Col>
          );
        })}
        {!items.length && <Text>{empty}</Text>}
      </Grid>
    </Box>
  );
}
