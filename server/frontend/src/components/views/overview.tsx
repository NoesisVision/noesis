import { IconFiles, IconPencilBolt } from '@tabler/icons-react';
import { useQuery } from '@tanstack/react-query';
import { designDocsList } from '#/api/design-docs.ts';
import { ChangesLink } from '#/components/core/changes-link.tsx';
import { useChangeId } from '#/components/core/use-change-id.ts';
import { Box } from '#/components/design-system/box.tsx';
import { Card } from '#/components/design-system/card.tsx';
import { Grid } from '#/components/design-system/grid.tsx';
import { OverviewSection } from '#/components/views/overview/overview-section.tsx';
import { OverviewStat } from '#/components/views/overview/overview-stat.tsx';
import {
  DESIGN_DOCS_NAV,
  DOCUMENTS_NAV,
} from '#/shell/navigation/nav-items.ts';
import { ViewHeader } from '#/shell/view-header.tsx';

export function OverviewView() {
  const { changeId } = useChangeId();
  const designDocsListQuery = useQuery(designDocsList(changeId));

  return (
    <Box>
      <ViewHeader />
      <Box>
        <Grid>
          <Grid.Col span={{ base: 12, md: 8, lg: 6 }}>
            <Card padding="lg" radius="md" withBorder>
              <Grid>
                <Grid.Col span={6}>
                  <OverviewStat title="Documents" Icon={IconFiles}>
                    <ChangesLink to={DOCUMENTS_NAV.to}>0</ChangesLink>
                  </OverviewStat>
                </Grid.Col>
                <Grid.Col span={6}>
                  <OverviewStat title="Design Docs" Icon={IconPencilBolt}>
                    <ChangesLink to={DESIGN_DOCS_NAV.to}>
                      {designDocsListQuery.data?.length ?? 0}
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
