import { getRouteApi } from '@tanstack/react-router';
import { DesignDocDetail } from './design-doc-detail.tsx';

const route = getRouteApi('/_shell/changes/$changeId/design-docs/$docId');

/** One design document, opened from the list or from the sidebar. */
export function DesignDocView() {
  const { changeId, docId } = route.useParams();

  return <DesignDocDetail changeId={changeId} id={docId} />;
}
