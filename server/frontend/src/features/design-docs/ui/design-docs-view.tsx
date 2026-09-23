import { useQuery } from '@tanstack/react-query';
import { getRouteApi } from '@tanstack/react-router';
import { Grid } from '#/shared/design-system/grid.tsx';
import { Stack } from '#/shared/design-system/stack';
import { CardLink } from '#/shared/ui/card-link.tsx';
import { LoadingPanel } from '#/shared/ui/loading-panel.tsx';
import { StatusPanel } from '#/shared/ui/status-panel.tsx';
import { designDocsList } from '../design-docs.api.ts';

const route = getRouteApi('/_shell/changes/$changeId/design-docs');

export function DesignDocsView() {
  const { changeId } = route.useParams();
  return (
    <Stack>
      <DesignDocList changeId={changeId} />
    </Stack>
  );
}

function DesignDocList({ changeId }: { changeId: string }) {
  const query = useQuery(designDocsList(changeId));
  if (query.isPending) return <LoadingPanel label="Loading design docs…" />;
  if (!query.data?.length)
    return (
      <StatusPanel
        headingLevel={2}
        title="No design documents yet"
        description="Ask the agent to design something into this change."
      />
    );
  return (
    <Grid>
      {query.data.map((doc) => (
        <Grid.Col key={doc.id} span={{ sm: 12, md: 6, lg: 4 }}>
          <CardLink
            to="/changes/$changeId/design-docs/$docId"
            params={{ changeId, docId: doc.id }}
            title={doc.name}
            description={doc.implemented ? 'Implemented' : 'Draft'}
          />
        </Grid.Col>
      ))}
    </Grid>
  );
}
