import { getRouteApi } from '@tanstack/react-router';
import { DocumentDetail } from './document-detail.tsx';

const route = getRouteApi('/_shell/changes/$changeId/documents/$documentId');

/** One document, opened from the list or from the sidebar. */
export function DocumentView() {
  const { changeId, documentId } = route.useParams();

  return <DocumentDetail changeId={changeId} id={documentId} />;
}
