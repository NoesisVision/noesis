import { getRouteApi } from '@tanstack/react-router';
import { DesignDocDetail } from './design-doc-detail.tsx';

const route = getRouteApi('/_shell/changes/$changeId/design-docs/$docId');

/**
 * One design document, opened from the list or from the sidebar. Where the
 * reader is in it lives in the address: stepping away and back returns them
 * to the element they were reading, and Back walks the ones before it.
 */
export function DesignDocView() {
  const { changeId, docId } = route.useParams();
  const { node, q } = route.useSearch();
  const navigate = route.useNavigate();

  return (
    <DesignDocDetail
      changeId={changeId}
      id={docId}
      node={node ?? null}
      query={q ?? ''}
      onSelect={(next, source) => {
        void navigate({
          search: (prev) => ({ ...prev, node: next }),
          // The row the outline opens at is not a place the reader went: it
          // names where they already are, so it takes the entry they arrived
          // on rather than leaving one for Back to walk through.
          replace: source === 'init',
        });
      }}
      // Typing is not a place to come back to, so a query replaces the entry
      // it is in rather than adding one per keystroke.
      onQuery={(next) => {
        void navigate({
          search: (prev) => ({ ...prev, q: next === '' ? undefined : next }),
          replace: true,
        });
      }}
    />
  );
}
