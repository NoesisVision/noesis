import { IconFiles, IconPencilBolt } from '@tabler/icons-react';
import { useQuery, type UseQueryResult } from '@tanstack/react-query';
import { designDocsList } from '#/features/design-docs/design-docs.api.ts';
import { documentsList } from '#/features/documents/documents.api.ts';
import { Box } from '#/shared/design-system/box.tsx';
import { Card } from '#/shared/design-system/card.tsx';
import { Grid } from '#/shared/design-system/grid.tsx';
import { useChangeId } from '../../current-change.ts';
import { ChangesLink } from '../changes-link.tsx';
import { OverviewSection } from './overview-section.tsx';
import { OverviewStat } from './overview-stat.tsx';

export function OverviewView() {
  const { changeId } = useChangeId();
  const documents = useQuery(documentsList(changeId));
  const designDocs = useQuery(designDocsList(changeId));

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
                      {count(documents)}
                    </ChangesLink>
                  </OverviewStat>
                </Grid.Col>
                <Grid.Col span={6}>
                  <OverviewStat title="Design Docs" Icon={IconPencilBolt}>
                    <ChangesLink to="/changes/$changeId/design-docs">
                      {count(designDocs)}
                    </ChangesLink>
                  </OverviewStat>
                </Grid.Col>
              </Grid>
            </Card>
          </Grid.Col>
        </Grid>
      </Box>
      <OverviewSection
        mt={16}
        title="Documents"
        empty={emptyText(documents, 'documents')}
        items={(documents.data ?? []).map((document) => ({
          id: document.id,
          title: (
            <ChangesLink
              to="/changes/$changeId/documents/$documentId"
              params={{ documentId: document.id }}
            >
              {document.title}
            </ChangesLink>
          ),
          content: document.date,
        }))}
      />
      <OverviewSection
        mt={16}
        title="Design Docs"
        empty={emptyText(designDocs, 'design documents')}
        items={(designDocs.data ?? []).map((doc) => ({
          id: doc.id,
          title: (
            <ChangesLink
              to="/changes/$changeId/design-docs/$docId"
              params={{ docId: doc.id }}
            >
              {doc.name}
            </ChangesLink>
          ),
          content: doc.implemented ? 'Implemented' : 'Draft',
        }))}
      />
    </Box>
  );
}

/** An em dash until the list is in: a stat of 0 that turns into 12 misleads. */
function count(query: UseQueryResult<{ length: number } | null>) {
  return query.data?.length ?? '—';
}

function emptyText(query: UseQueryResult<unknown>, what: string): string {
  if (query.isPending) return `Loading ${what}…`;
  if (query.isError) return `Could not load the ${what} of this change.`;
  return `No ${what} yet for this change.`;
}
