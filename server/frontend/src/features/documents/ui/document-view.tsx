import { getRouteApi } from '@tanstack/react-router';
import { Stack } from '#/shared/design-system/stack';
import { DocumentDetail } from './document-detail.tsx';

const route = getRouteApi('/_shell/changes/$changeId/documents/$documentId');

/** One document, opened from the list or from the sidebar. */
export function DocumentView() {
  const { changeId, documentId } = route.useParams();

  return (
    <Stack>
      <DocumentDetail changeId={changeId} id={documentId} />
    </Stack>
  );
}
