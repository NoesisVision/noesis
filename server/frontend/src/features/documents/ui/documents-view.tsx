import { useQuery } from '@tanstack/react-query';
import { getRouteApi, Link } from '@tanstack/react-router';
import { Card } from '#/shared/design-system/card';
import { Stack } from '#/shared/design-system/stack';
import { Text } from '#/shared/design-system/text';
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
    <Stack>
      {query.data.map((doc) => (
        <Card key={doc.id} withBorder padding="lg">
          <Link
            to="/changes/$changeId/documents/$documentId"
            params={{ changeId, documentId: doc.id }}
          >
            {doc.title}
          </Link>
          <Text size="sm" c="dimmed">
            {doc.date}
          </Text>
        </Card>
      ))}
    </Stack>
  );
}
