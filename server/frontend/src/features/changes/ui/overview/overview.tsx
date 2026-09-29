import { useQuery } from '@tanstack/react-query';
import { getRouteApi } from '@tanstack/react-router';
import { DesignDocsIcon } from '#/features/design-docs/design-docs.model.ts';
import { DocumentsIcon } from '#/features/documents/documents.model.ts';
import { Box } from '#/shared/design-system/box.tsx';
import { Card } from '#/shared/design-system/card.tsx';
import { Grid } from '#/shared/design-system/grid.tsx';
import { CardLink } from '#/shared/ui/card-link.tsx';
import { FormattedDate } from '#/shared/ui/formatted-date.tsx';
import { changeById } from '../../changes.api.ts';
import { ChangesLink } from '../changes-link.tsx';
import { OverviewSection } from './overview-section.tsx';
import { OverviewStat } from './overview-stat.tsx';

const route = getRouteApi('/_shell/changes/$changeId/');

export function OverviewView() {
  const { changeId } = route.useParams();
  const { data: change, isPending } = useQuery(changeById(changeId));
  const documents = change?.documents;
  const designDocs = change?.designDocs;

  return (
    <Box>
      <Box>
        <Grid>
          <Grid.Col span={{ base: 12, md: 8, lg: 6 }}>
            <Card padding="lg">
              <Grid>
                <Grid.Col span={6}>
                  <OverviewStat title="Documents" Icon={DocumentsIcon}>
                    <ChangesLink to="/changes/$changeId/documents">
                      {count(documents)}
                    </ChangesLink>
                  </OverviewStat>
                </Grid.Col>
                <Grid.Col span={6}>
                  <OverviewStat title="Design Docs" Icon={DesignDocsIcon}>
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
        empty={emptyText(isPending, 'documents')}
        items={(documents ?? []).map((document) => ({
          id: document.id,
          card: (
            <CardLink
              to="/changes/$changeId/documents/$documentId"
              params={{ changeId, documentId: document.id }}
              title={document.title}
              icon={DocumentsIcon}
              description={<FormattedDate value={document.date} />}
              headingLevel={3}
            />
          ),
        }))}
      />
      <OverviewSection
        mt={16}
        title="Design Docs"
        empty={emptyText(isPending, 'design documents')}
        items={(designDocs ?? []).map((doc) => ({
          id: doc.id,
          card: (
            <CardLink
              to="/changes/$changeId/design-docs/$docId"
              params={{ changeId, docId: doc.id }}
              title={doc.name}
              icon={DesignDocsIcon}
              description={doc.implemented ? 'Implemented' : 'Draft'}
              headingLevel={3}
            />
          ),
        }))}
      />
    </Box>
  );
}

/** An em dash until the list is in: a stat of 0 that turns into 12 misleads. */
function count(list: readonly unknown[] | undefined) {
  return list?.length ?? '—';
}

// A failure never reaches here: it is thrown to the route's boundary.
function emptyText(isPending: boolean, what: string): string {
  if (isPending) return `Loading ${what}…`;
  return `No ${what} yet for this change.`;
}
