import {
  IconFileText,
  IconGitBranch,
  IconTopologyStar3,
} from '@tabler/icons-react';
import type { NavigateOptions } from '@tanstack/react-router';
import { changeKindLine } from '#/features/changes/changes.model.ts';
import { outlineOf } from '#/features/design-docs/design-doc-outline.ts';
import {
  DESIGN_DOC_VIEWS,
  DesignDocsIcon,
} from '#/features/design-docs/design-docs.model.ts';
import { addressOf } from '#/features/design-docs/element-id.ts';
import { kindIconOf } from '#/features/design-docs/ui/model-tree/kind-icon.tsx';
import { designOf } from '#/features/system-model/system-model.model.ts';
import type { IconComponent } from '#/shared/ui/icon-heading.tsx';
import { titleCase } from '#/shared/ui/title-case.ts';
import type { ChangeWithEntries } from '#backend/app/changes/change-entry.ts';
import type { SystemModel } from '#backend/app/system-model/system-model.ts';

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
  /** The most it lists; what matches past it is only counted. */
  limit?: number;
}

/** A group as the results list it: what fits, and how many more matched. */
export interface MatchingGroup {
  label: string;
  entries: SearchEntry[];
  more: number;
}

/** How many of the model's elements one search lists before it says "more". */
const MODEL_ELEMENTS_LISTED = 20;

interface SearchSources {
  changes: ChangeWithEntries[];
  activeChange: ChangeWithEntries | null;
  projectName: string | undefined;
  /** The model scanned last; null before the first scan. */
  systemModel: SystemModel | null;
}

/**
 * Everything search knows about, in the order it lists it: what is in the
 * change you are in first, then the app's own places and the elements of the
 * system model, then the other changes.
 */
export function searchGroups({
  changes,
  activeChange,
  projectName,
  systemModel,
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
  if (systemModel !== null) {
    groups.push({
      label: 'System model',
      entries: modelElements(systemModel),
      limit: MODEL_ELEMENTS_LISTED,
    });
  }
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
 * The scanned model's modules, building blocks and behaviours, each opening
 * the model tree at its row. Its parts — properties, rules, scenarios — are
 * left to the tree. Too many to list unasked, so each waits for a query.
 */
function modelElements(model: SystemModel): SearchEntry[] {
  return outlineOf(designOf(model)).flatMap((node): SearchEntry[] => {
    if (node.elementId === null) return [];
    const address = addressOf(node.elementId);
    const owner = address.slice(0, Math.max(address.lastIndexOf('.'), 0));
    return [
      {
        id: `element:${node.path}`,
        label: node.name,
        context: [node.patternLabel ?? titleCase(node.kind), owner]
          .filter(Boolean)
          .join(' · '),
        icon: kindIconOf(node.kind, node.pattern),
        link: { to: '/system-model', search: { node: node.path } },
        onlyWhenAsked: true,
      },
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
): MatchingGroup[] {
  const words = query.trim().toLowerCase();
  return groups
    .map((group) => {
      const matches = group.entries.filter((entry) =>
        words === ''
          ? !entry.onlyWhenAsked
          : `${entry.label} ${entry.context}`.toLowerCase().includes(words),
      );
      const listed = matches.slice(0, group.limit ?? matches.length);
      return {
        label: group.label,
        entries: listed,
        more: matches.length - listed.length,
      };
    })
    .filter((group) => group.entries.length > 0);
}
