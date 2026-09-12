import { AppShell, Box, NavLink, ScrollArea, Text } from '@mantine/core';
import {
  IconBook,
  IconFiles,
  IconLayoutDashboard,
  IconMessages,
  IconPencilBolt,
  IconTopologyStar3,
} from '@tabler/icons-react';
import { useSuspenseQuery } from '@tanstack/react-query';
import {
  Link,
  type RouteIds,
  useMatches,
  useParams,
} from '@tanstack/react-router';
import type { ComponentType } from 'react';
import { changesList } from '#/api/changes';
import type { routeTree } from '#/routeTree.gen';
import { ChangePicker } from './change-picker';
import { readLastChange } from './last-change';

interface SidebarProps {
  /** Closes the mobile drawer after a choice. */
  onNavigate: () => void;
}

interface IconProps {
  size?: number;
  stroke?: number;
}

const CHANGE_ENTRIES: {
  to:
    | '/changes/$changeId'
    | '/changes/$changeId/documents'
    | '/changes/$changeId/conversations'
    | '/changes/$changeId/design-docs';
  /** The leaf route's id: present in the matches only while that view is on. */
  routeId: RouteIds<typeof routeTree>;
  label: string;
  description: string;
  icon: ComponentType<IconProps>;
}[] = [
  {
    to: '/changes/$changeId',
    routeId: '/_shell/changes/$changeId/',
    label: 'Overview',
    description: 'Status, scope and what happened last',
    icon: IconLayoutDashboard,
  },
  {
    to: '/changes/$changeId/documents',
    routeId: '/_shell/changes/$changeId/documents',
    label: 'Documents',
    description: 'Imported material that informs the change',
    icon: IconFiles,
  },
  {
    to: '/changes/$changeId/conversations',
    routeId: '/_shell/changes/$changeId/conversations',
    label: 'Conversations',
    description: 'Imported discussions with the agent',
    icon: IconMessages,
  },
  {
    to: '/changes/$changeId/design-docs',
    routeId: '/_shell/changes/$changeId/design-docs',
    label: 'Design docs',
    description: 'The design documents of this change',
    icon: IconPencilBolt,
  },
];

const DOCUMENTATION_ENTRIES: {
  to: '/system-model' | '/wiki';
  routeId: RouteIds<typeof routeTree>;
  label: string;
  description: string;
  icon: ComponentType<IconProps>;
}[] = [
  {
    to: '/system-model',
    routeId: '/_shell/system-model',
    label: 'System model',
    description: 'What the code is made of',
    icon: IconTopologyStar3,
  },
  {
    to: '/wiki',
    routeId: '/_shell/wiki',
    label: 'Wiki',
    description: 'Topics and decisions',
    icon: IconBook,
  },
];

/**
 * Option C of the prototype: the change picker on top, the four change-scoped
 * entries under it, and the change-independent documentation pinned at the
 * bottom. The active change is the one in the URL, else the last opened,
 * else the first in the list — so the four entries work from `/wiki` too.
 */
export function Sidebar({ onNavigate }: SidebarProps) {
  const { data: changes } = useSuspenseQuery(changesList);
  const { changeId } = useParams({ strict: false });
  // Active by leaf route id, not by pathname: `matchRoute` reports the change
  // layout as matching under every view beneath it, so Overview would stay
  // lit. The Link is told the same (`exact`), because Mantine's NavLink also
  // styles the `aria-current` the Link sets on a fuzzy match.
  const activeIds = new Set<RouteIds<typeof routeTree>>(
    useMatches().map((match) => match.routeId),
  );

  const lastChangeId = readLastChange();
  const activeChange =
    changes.find((c) => c.slug === changeId) ??
    changes.find((c) => c.slug === lastChangeId) ??
    changes[0] ??
    null;

  return (
    <>
      <AppShell.Section px="md" pt="md" pb="md">
        <ChangePicker
          changes={changes}
          current={activeChange}
          onNavigate={onNavigate}
        />
      </AppShell.Section>
      <AppShell.Section grow component={ScrollArea} px="xs">
        {CHANGE_ENTRIES.map((entry) => {
          const params = { changeId: activeChange?.slug ?? '' };
          return (
            <NavLink
              key={entry.to}
              label={entry.label}
              description={entry.description}
              leftSection={<entry.icon size={18} stroke={1.6} />}
              disabled={activeChange === null}
              active={activeIds.has(entry.routeId)}
              onClick={onNavigate}
              renderRoot={(props) => (
                <Link
                  {...props}
                  to={entry.to}
                  params={params}
                  activeOptions={{ exact: true }}
                />
              )}
            />
          );
        })}
      </AppShell.Section>
      <AppShell.Section
        px="xs"
        py="sm"
        style={{
          borderTop: '1px solid var(--mantine-color-default-border)',
          background:
            'light-dark(var(--mantine-color-gray-0), var(--mantine-color-dark-8))',
        }}
      >
        <Box px="sm" pb={4}>
          <Text size="xs" fw={600} c="dimmed" tt="uppercase">
            Documentation
          </Text>
        </Box>
        {DOCUMENTATION_ENTRIES.map((entry) => (
          <NavLink
            key={entry.to}
            label={entry.label}
            description={entry.description}
            leftSection={<entry.icon size={18} stroke={1.6} />}
            active={activeIds.has(entry.routeId)}
            onClick={onNavigate}
            renderRoot={(props) => (
              <Link {...props} to={entry.to} activeOptions={{ exact: true }} />
            )}
          />
        ))}
      </AppShell.Section>
    </>
  );
}
