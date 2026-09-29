import { useQuery } from '@tanstack/react-query';
import { getRouteApi } from '@tanstack/react-router';
import { changeById } from '#/features/changes/changes.api.ts';
import { Grid } from '#/shared/design-system/grid.tsx';
import { Stack } from '#/shared/design-system/stack';
import { CardLink } from '#/shared/ui/card-link.tsx';
import { FormattedDate } from '#/shared/ui/formatted-date.tsx';
import { LoadingPanel } from '#/shared/ui/loading-panel.tsx';
import { StatusPanel } from '#/shared/ui/status-panel.tsx';
import { DocumentsIcon } from '../documents.model.ts';

const route = getRouteApi('/_shell/changes/$changeId/documents');

export function DocumentsView() {
  const { changeId } = route.useParams();
  return (
    <Stack>
      <DocumentList changeId={changeId} />
    </Stack>
  );
}

function DocumentList({ changeId }: { changeId: string }) {
  const { data: change, isPending } = useQuery(changeById(changeId));
  if (isPending) return <LoadingPanel label="Loading documents…" />;
  if (!change?.documents.length)
    return (
      <StatusPanel
        headingLevel={2}
        title="No documents yet"
        description="Ask the agent to import the material this change is informed by."
      />
    );
  return (
    <Grid>
      {change.documents.map((doc) => (
        <Grid.Col key={doc.id} span={{ sm: 12, md: 6, lg: 4 }}>
          <CardLink
            to="/changes/$changeId/documents/$documentId"
            params={{ changeId, documentId: doc.id }}
            title={doc.title}
            icon={DocumentsIcon}
            description={<FormattedDate value={doc.date} />}
          />
        </Grid.Col>
      ))}
    </Grid>
  );
}
