import { getRouteApi } from '@tanstack/react-router';
import { useCallback } from 'react';
import type { SelectSource } from '#/features/design-docs/ui/model-tree/use-model-tree.ts';
import type { DesignDocViewName } from '../design-docs.model.ts';
import { DesignDocDetail } from './design-doc-detail.tsx';
import type { ViewPlace } from './view-place.ts';

const route = getRouteApi('/_shell/changes/$changeId/design-docs/$docId');

/**
 * One design document, opened from the list or from the sidebar. Where the
 * reader is in it lives in the address: stepping away and back returns them
 * to the element they were reading, and Back walks the ones before it.
 */
export function DesignDocView() {
  const { changeId, docId } = route.useParams();
  const { view } = route.useSearch();
  const navigate = route.useNavigate();
  const model = usePlace('node', 'q');
  // The requirements' place is kept as the model's is, under names of its own.
  const requirements = usePlace('entry', 'entryQ');
  // So is the architecture's, where nothing in hand is a place as well.
  const architecture = usePlace('arch', 'archQ');

  // Another view is a place to come back to, so switching leaves an entry
  // for Back; the element in hand stays in the address for the model.
  const onView = useCallback(
    (next: DesignDocViewName) => {
      void navigate({
        search: (prev) => ({
          ...prev,
          view: next === 'model' ? undefined : next,
        }),
      });
    },
    [navigate],
  );

  // A link from the overview into the requirements is a place to come back to.
  const onRequirement = useCallback(
    (entry: string) => {
      void navigate({
        search: (prev) => ({ ...prev, view: 'requirements', entry }),
      });
    },
    [navigate],
  );

  return (
    <DesignDocDetail
      changeId={changeId}
      id={docId}
      view={view ?? 'model'}
      onView={onView}
      onRequirement={onRequirement}
      model={model}
      requirements={requirements}
      architecture={architecture}
    />
  );
}

/**
 * One view's place in the address, under the two names the view keeps it by:
 * the row in hand, and what is being looked for.
 */
function usePlace(
  row: 'node' | 'entry' | 'arch',
  asked: 'q' | 'entryQ' | 'archQ',
): ViewPlace {
  const search = route.useSearch();
  const navigate = route.useNavigate();
  const onSelect = useCallback(
    (next: string, source: SelectSource) => {
      void navigate({
        // Nothing in hand leaves no name in the address.
        search: (prev) => ({ ...prev, [row]: next === '' ? undefined : next }),
        // The row the outline opens at is not a place the reader went: it
        // names where they already are, so it takes the entry they arrived
        // on rather than leaving one for Back to walk through.
        replace: source === 'init',
      });
    },
    [navigate, row],
  );
  // Typing is not a place to come back to, so a query replaces the entry it
  // is in rather than adding one per keystroke.
  const onQuery = useCallback(
    (next: string) => {
      void navigate({
        search: (prev) => ({
          ...prev,
          [asked]: next === '' ? undefined : next,
        }),
        replace: true,
      });
    },
    [navigate, asked],
  );

  return {
    selected: search[row] ?? null,
    query: search[asked] ?? '',
    onSelect,
    onQuery,
  };
}
