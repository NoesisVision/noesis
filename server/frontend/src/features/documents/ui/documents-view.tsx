import { useQuery } from '@tanstack/react-query';
import { getRouteApi } from '@tanstack/react-router';
import { Grid } from '#/shared/design-system/grid.tsx';
import { Stack } from '#/shared/design-system/stack';
import { Text } from '#/shared/design-system/text';
import { CardLink } from '#/shared/ui/card-link.tsx';
import { documentsList } from '../documents.api.ts';
import { DocumentsLoadError } from './documents-load-error.tsx';

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
  if (query.isError)
    return <DocumentsLoadError retry={() => void query.refetch()} />;
  if (!query.data?.length)
    return <Text>No documents yet for this change.</Text>;
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
