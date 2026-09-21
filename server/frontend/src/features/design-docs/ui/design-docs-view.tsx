import { useQuery } from '@tanstack/react-query';
import { getRouteApi, Link } from '@tanstack/react-router';
import { Card } from '#/shared/design-system/card';
import { Stack } from '#/shared/design-system/stack';
import { Text } from '#/shared/design-system/text';
import { ViewHeader } from '#/shell/view-header.tsx';
import { designDocsList } from '../design-docs.api.ts';
import { DesignDocsLoadError } from './design-docs-load-error.tsx';

const route = getRouteApi('/_shell/changes/$changeId/design-docs');

export function DesignDocsView() {
  const { changeId } = route.useParams();
  return (
    <Stack>
      <ViewHeader />
      <DesignDocList changeId={changeId} />
    </Stack>
  );
}

function DesignDocList({ changeId }: { changeId: string }) {
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
