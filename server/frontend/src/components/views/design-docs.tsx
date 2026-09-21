import { useQuery } from '@tanstack/react-query';
import { getRouteApi, Link } from '@tanstack/react-router';
import { designDocsList } from '#/api/design-docs';
import { Card } from '#/components/design-system/card';
import { Stack } from '#/components/design-system/stack';
import { Text } from '#/components/design-system/text';
import { ViewHeader } from '#/components/shell/view-header';
import { DesignDocsLoadError } from './design-doc/design-docs-load-error.tsx';
import { DocumentDetail } from './document-detail';

const route = getRouteApi('/_shell/changes/$changeId/design-docs');

export function DesignDocsView() {
  const { changeId } = route.useParams();
  return (
    <Stack>
      <ViewHeader />
      <DocumentList changeId={changeId} />
    </Stack>
  );
}

export function DesignDocDetailView() {
  const { changeId, docId } = getRouteApi(
    '/_shell/changes/$changeId/design-docs/$docId',
  ).useParams();
  return (
    <Stack>
      <ViewHeader />
      <Link to="/changes/$changeId/design-docs" params={{ changeId }}>
        Back to design docs
      </Link>
      <DocumentDetail changeId={changeId} id={docId} />
    </Stack>
  );
}

function DocumentList({ changeId }: { changeId: string }) {
  const query = useQuery(designDocsList(changeId));
  if (query.isPending)
    return <Text component="output">Loading design docs…</Text>;
  if (query.isError)
    return <DesignDocsLoadError retry={() => void query.refetch()} />;
  if (!query.data?.length)
    return <Text>No design documents yet for this change.</Text>;
  return (
    <Stack>
      {query.data.map((doc) => (
        <Card key={doc.id} withBorder padding="lg">
          <Link
            to="/changes/$changeId/design-docs/$docId"
            params={{ changeId, docId: doc.id }}
          >
            {doc.name}
          </Link>
          <Text size="sm" c="dimmed">
            {doc.status} · {doc.date}
          </Text>
        </Card>
      ))}
    </Stack>
  );
}
