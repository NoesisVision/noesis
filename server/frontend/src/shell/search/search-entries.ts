import {
  IconFileText,
  IconGitBranch,
  IconTopologyStar3,
} from '@tabler/icons-react';
import type { NavigateOptions } from '@tanstack/react-router';
import { changeKindLine } from '#/features/changes/changes.model.ts';
import {
  DESIGN_DOC_VIEWS,
  DesignDocsIcon,
} from '#/features/design-docs/design-docs.model.ts';
import type { IconComponent } from '#/shared/ui/icon-heading.tsx';
import { titleCase } from '#/shared/ui/title-case.ts';
import type { ChangeWithEntries } from '#backend/app/changes/change-entry.ts';

/** One place search can take you: what it is called, and where it opens. */
export interface SearchEntry {
  id: string;
  label: string;
  /** What kind of thing it is, and whose: the line under its name. */
  context: string;
  icon: IconComponent;
  link: NavigateOptions;
  /** Too fine-grained to list unasked: shown only once something is typed. */
  onlyWhenAsked?: boolean;
}

export interface SearchGroup {
  label: string;
  entries: SearchEntry[];
}

interface SearchSources {
  changes: ChangeWithEntries[];
  activeChange: ChangeWithEntries | null;
  projectName: string | undefined;
}

/**
 * Everything search knows about, in the order it lists it: what is in the
 * change you are in first, then the app's own places, then the other changes.
 */
export function searchGroups({
  changes,
  activeChange,
  projectName,
}: SearchSources): SearchGroup[] {
  const groups: SearchGroup[] = [];
  if (activeChange !== null) {
    groups.push({
      label: `In ${activeChange.name}`,
      entries: changeEntries(activeChange),
    });
  }
  groups.push({
    label: 'Workspace',
    entries: [
      {
        id: 'system-model',
        label: 'System model',
        context: [projectName, 'independent of changes']
          .filter(Boolean)
          .join(' · '),
        icon: IconTopologyStar3,
        link: { to: '/system-model' },
      },
    ],
  });
  groups.push({
    label: 'Changes',
    entries: changes
      .filter((change) => change.id !== activeChange?.id)
      .map((change) => ({
        id: `change:${change.id}`,
        label: change.name,
        context: `Change · ${changeKindLine(change)}`,
        icon: IconGitBranch,
        link: { to: '/changes/$changeId', params: { changeId: change.id } },
      })),
  });
  return groups;
}

/** A change's documents and design docs, and — when asked — each doc's views. */
function changeEntries(change: ChangeWithEntries): SearchEntry[] {
  const changeId = change.id;
  return change.entries.flatMap((entry): SearchEntry[] => {
    if (entry.kind === 'document') {
      return [
        {
          id: `document:${entry.id}`,
          label: entry.name,
          context: 'Document',
          icon: IconFileText,
          link: {
            to: '/changes/$changeId/documents/$documentId',
            params: { changeId, documentId: entry.id },
          },
        },
      ];
    }
    const link = {
      to: '/changes/$changeId/design-docs/$docId',
      params: { changeId, docId: entry.id },
    } as const;
    return [
      {
        id: `design-doc:${entry.id}`,
        label: entry.name,
        context: 'Design doc',
        icon: DesignDocsIcon,
        link,
      },
      // The overview is where the doc itself opens.
      ...DESIGN_DOC_VIEWS.filter((view) => view !== 'overview').map((view) => ({
        id: `design-doc:${entry.id}:${view}`,
        label: titleCase(view),
        context: `Design doc · ${entry.name}`,
        icon: DesignDocsIcon,
        link: { ...link, search: { view } },
        onlyWhenAsked: true,
      })),
    ];
  });
}

/**
 * The groups holding what matches the query, by name or by kind, without
 * the groups left empty. Nothing typed lists everything but the fine grain.
 */
export function matchingGroups(
  groups: SearchGroup[],
  query: string,
): SearchGroup[] {
  const words = query.trim().toLowerCase();
  return groups
    .map((group) => ({
      label: group.label,
      entries: group.entries.filter((entry) =>
        words === ''
          ? !entry.onlyWhenAsked
          : `${entry.label} ${entry.context}`.toLowerCase().includes(words),
      ),
    }))
    .filter((group) => group.entries.length > 0);
}
