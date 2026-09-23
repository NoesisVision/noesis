import { useQuery } from '@tanstack/react-query';
import { getRouteApi } from '@tanstack/react-router';
import { Grid } from '#/shared/design-system/grid.tsx';
import { Stack } from '#/shared/design-system/stack';
import { Text } from '#/shared/design-system/text';
import { CardLink } from '#/shared/ui/card-link.tsx';
import { StatusPanel } from '#/shared/ui/status-panel.tsx';
import { documentsList } from '../documents.api.ts';

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
  const query = useQuery(documentsList(changeId));
  if (query.isPending)
    return <Text component="output">Loading documents…</Text>;
  if (!query.data?.length)
    return (
      <StatusPanel
        headingLevel={2}
        title="No documents yet"
        description="Ask the agent to import the material this change is informed by."
      />
    );
  return (
    <Grid>
      {query.data.map((doc) => (
        <Grid.Col key={doc.id} span={{ sm: 12, md: 6, lg: 4 }}>
          <CardLink
            to="/changes/$changeId/documents/$documentId"
            params={{ changeId, documentId: doc.id }}
            title={doc.title}
            description={doc.date}
          />
        </Grid.Col>
      ))}
    </Grid>
  );
}
