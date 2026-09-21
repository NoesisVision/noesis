import { IconFiles, IconPencilBolt } from '@tabler/icons-react';
import { Box } from '#/shared/design-system/box.tsx';
import { Card } from '#/shared/design-system/card.tsx';
import { Grid } from '#/shared/design-system/grid.tsx';
import { useChangeNavigation } from '../../changes.api.ts';
import { ChangesLink } from '../changes-link.tsx';
import { OverviewSection } from './overview-section.tsx';
import { OverviewStat } from './overview-stat.tsx';

export function OverviewView() {
  const { activeChange } = useChangeNavigation();

  return (
    <Box>
      <Box>
        <Grid>
          <Grid.Col span={{ base: 12, md: 8, lg: 6 }}>
            <Card padding="lg" radius="md" withBorder>
              <Grid>
                <Grid.Col span={6}>
                  <OverviewStat title="Documents" Icon={IconFiles}>
                    <ChangesLink to="/changes/$changeId/documents">
                      0
                    </ChangesLink>
                  </OverviewStat>
                </Grid.Col>
                <Grid.Col span={6}>
                  <OverviewStat title="Design Docs" Icon={IconPencilBolt}>
                    <ChangesLink to="/changes/$changeId/design-docs">
                      {activeChange?.designDocs.length ?? 0}
                    </ChangesLink>
                  </OverviewStat>
                </Grid.Col>
              </Grid>
            </Card>
          </Grid.Col>
        </Grid>
      </Box>
      <OverviewSection mt={16} title="Documents" items={[]} />
      <OverviewSection mt={16} title="Design Docs" items={[]} />
    </Box>
  );
}
