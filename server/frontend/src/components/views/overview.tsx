import { IconFiles, IconMessages, IconPencilBolt } from '@tabler/icons-react';
import { useChangeId } from '#/components/core/useChangeId.ts';
import { Box } from '#/components/design-system/box.tsx';
import { Card } from '#/components/design-system/card.tsx';
import { Grid } from '#/components/design-system/grid.tsx';
import { Text } from '#/components/design-system/text.tsx';
import { Title } from '#/components/design-system/title.tsx';
import {
  CONVERSATIONS_ROUTE,
  DESIGN_DOCS_ROUTE,
  DOCUMENTS_ROUTE,
} from '#/components/shell/sidebar.routes.ts';
import { ViewHeader } from '#/components/shell/view-header';
import { OverviewStat } from '#/components/views/overview/overview-stat.tsx';

export function OverviewView() {
  const { changeId } = useChangeId();
  return (
    <Box>
      <ViewHeader />
      <Box>
        <Grid>
          <Grid.Col span={4}>
            <Card padding="lg" radius="md" withBorder>
              <Grid>
                <Grid.Col span={4}>
                  <OverviewStat
                    changeId={changeId}
                    title="Documents"
                    Icon={IconFiles}
                    to={DOCUMENTS_ROUTE.to}
                  >
                    0
                  </OverviewStat>
                </Grid.Col>
                <Grid.Col span={4}>
                  <OverviewStat
                    changeId={changeId}
                    title="Conversations"
                    Icon={IconMessages}
                    to={CONVERSATIONS_ROUTE.to}
                  >
                    0
                  </OverviewStat>
                </Grid.Col>
                <Grid.Col span={4}>
                  <OverviewStat
                    changeId={changeId}
                    title="Design Docs"
                    Icon={IconPencilBolt}
                    to={DESIGN_DOCS_ROUTE.to}
                  >
                    0
                  </OverviewStat>
                </Grid.Col>
              </Grid>
            </Card>
          </Grid.Col>
        </Grid>
      </Box>
      <Box mt={16}>
        <Title order={3} mb={8}>
          Documents
        </Title>
        <Card padding="lg" radius="md" withBorder>
          <Title order={4} mb={8}>
            Doc 1
          </Title>
          <Text size="sm">Sample doc 1</Text>
        </Card>
      </Box>
    </Box>
  );
}
