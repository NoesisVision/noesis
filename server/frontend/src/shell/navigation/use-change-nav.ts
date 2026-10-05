import { useParams } from '@tanstack/react-router';
import { useChangesWithEntries } from '#/features/changes/changes.api.ts';
import {
  DESIGN_DOCS_NAV,
  DOCUMENTS_NAV,
  type NavItem,
} from '#/shell/navigation/nav-items.ts';

/** Where a named child of a change opens, one arm per group. */
type ChangeChildLink =
  | {
      to: '/changes/$changeId/documents/$documentId';
      params: { changeId: string; documentId: string };
    }
  | {
      to: '/changes/$changeId/design-docs/$docId';
      params: { changeId: string; docId: string };
    };

export interface ChangeNavChild {
  id: string;
  name: string;
  link: ChangeChildLink;
  /** The child open at the address. */
  open: boolean;
}

/** The views that name their own contents beneath them, by the view's path. */
type ChangeNavChildren = Partial<Record<NavItem['to'], ChangeNavChild[]>>;

/**
 * The change the navigation is about, and the named children of its views.
 * Shared by the header and the phone menu, which lay the same things out
 * differently.
 */
export function useChangeNav() {
  const { changes, activeChange } = useChangesWithEntries();
  const { documentId, docId } = useParams({ strict: false });
  const changeId = activeChange?.id ?? '';
  const entries = activeChange?.entries ?? [];

  const children: ChangeNavChildren = {
    [DOCUMENTS_NAV.to]: entries
      .filter((entry) => entry.kind === 'document')
      .map(({ id, name }) => ({
        id,
        name,
        open: id === documentId,
        link: {
          to: '/changes/$changeId/documents/$documentId',
          params: { changeId, documentId: id },
        },
      })),
    [DESIGN_DOCS_NAV.to]: entries
      .filter((entry) => entry.kind === 'design-doc')
      .map(({ id, name }) => ({
        id,
        name,
        open: id === docId,
        link: {
          to: '/changes/$changeId/design-docs/$docId',
          params: { changeId, docId: id },
        },
      })),
  };

  return { changes, activeChange, params: { changeId }, children };
}
