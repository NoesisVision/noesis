import { getRouteApi } from '@tanstack/react-router';
import { useCallback } from 'react';
import type { SelectSource } from '#/shared/ui/model-tree/use-model-tree.ts';
import type { DesignDocViewName } from '../design-docs.model.ts';
import { DesignDocDetail } from './design-doc-detail.tsx';

const route = getRouteApi('/_shell/changes/$changeId/design-docs/$docId');

/**
 * One design document, opened from the list or from the sidebar. Where the
 * reader is in it lives in the address: stepping away and back returns them
 * to the element they were reading, and Back walks the ones before it.
 */
export function DesignDocView() {
  const { changeId, docId } = route.useParams();
  const { view, node, q, entry, entryQ, arch, archQ } = route.useSearch();
  const navigate = route.useNavigate();
  const onSelect = useCallback(
    (next: string, source: SelectSource) => {
      void navigate({
        search: (prev) => ({ ...prev, node: next }),
        // The row the outline opens at is not a place the reader went: it
        // names where they already are, so it takes the entry they arrived
        // on rather than leaving one for Back to walk through.
        replace: source === 'init',
      });
    },
    [navigate],
  );
  // Typing is not a place to come back to, so a query replaces the entry it
  // is in rather than adding one per keystroke.
  const onQuery = useCallback(
    (next: string) => {
      void navigate({
        search: (prev) => ({ ...prev, q: next === '' ? undefined : next }),
        replace: true,
      });
    },
    [navigate],
  );

  // The requirements' place is kept as the model's is, under names of its own.
  const onEntry = useCallback(
    (next: string, source: SelectSource) => {
      void navigate({
        search: (prev) => ({ ...prev, entry: next }),
        replace: source === 'init',
      });
    },
    [navigate],
  );
  const onEntryQuery = useCallback(
    (next: string) => {
      void navigate({
        search: (prev) => ({
          ...prev,
          entryQ: next === '' ? undefined : next,
        }),
        replace: true,
      });
    },
    [navigate],
  );

  // So is the architecture's, where nothing in hand is a place as well.
  const onArch = useCallback(
    (next: string, source: SelectSource) => {
      void navigate({
        search: (prev) => ({
          ...prev,
          arch: next === '' ? undefined : next,
        }),
        replace: source === 'init',
      });
    },
    [navigate],
  );
  const onArchQuery = useCallback(
    (next: string) => {
      void navigate({
        search: (prev) => ({
          ...prev,
          archQ: next === '' ? undefined : next,
        }),
        replace: true,
      });
    },
    [navigate],
  );

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

  return (
    <DesignDocDetail
      changeId={changeId}
      id={docId}
      view={view ?? 'model'}
      onView={onView}
      node={node ?? null}
      query={q ?? ''}
      onSelect={onSelect}
      onQuery={onQuery}
      requirements={{
        selected: entry ?? null,
        query: entryQ ?? '',
        onSelect: onEntry,
        onQuery: onEntryQuery,
      }}
      architecture={{
        selected: arch ?? null,
        query: archQ ?? '',
        onSelect: onArch,
        onQuery: onArchQuery,
      }}
    />
  );
}
