import { getRouteApi, Link } from '@tanstack/react-router';
import { Stack } from '#/components/design-system/stack';
import { ViewHeader } from '#/shell/view-header.tsx';
import { DesignDocDetail } from './design-doc-detail.tsx';

const route = getRouteApi('/_shell/changes/$changeId/design-docs/$docId');

/** One design document, opened from the list or from the sidebar. */
export function DesignDocView() {
  const { changeId, docId } = route.useParams();

  return (
    <Stack>
      <ViewHeader />
      <Link to="/changes/$changeId/design-docs" params={{ changeId }}>
        Back to design docs
      </Link>
      <DesignDocDetail changeId={changeId} id={docId} />
    </Stack>
  );
}
