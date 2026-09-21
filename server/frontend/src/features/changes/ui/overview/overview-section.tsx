import type { ReactNode } from 'react';
import { Box } from '#/components/design-system/box.tsx';
import { Card } from '#/components/design-system/card.tsx';
import { Grid } from '#/components/design-system/grid.tsx';
import { Text } from '#/components/design-system/text.tsx';
import { Title } from '#/components/design-system/title.tsx';

interface OverviewSectionItem {
  id: string;
  title: string;
  content?: ReactNode;
}

interface OverviewSectionProps {
  title: string;
  items: OverviewSectionItem[];
  mt?: number;
}

export function OverviewSection({ title, mt, items }: OverviewSectionProps) {
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
        {!items.length && <Text>No items</Text>}
      </Grid>
    </Box>
  );
}
