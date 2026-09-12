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
import { Link, useMatchRoute, useParams } from '@tanstack/react-router';
import type { ComponentType } from 'react';
import { changesList } from '#/api/changes';
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
  label: string;
  description: string;
  icon: ComponentType<IconProps>;
}[] = [
  {
    to: '/changes/$changeId',
    label: 'Overview',
    description: 'Status, scope and what happened last',
    icon: IconLayoutDashboard,
  },
  {
    to: '/changes/$changeId/documents',
    label: 'Documents',
    description: 'Imported material that informs the change',
    icon: IconFiles,
  },
  {
    to: '/changes/$changeId/conversations',
    label: 'Conversations',
    description: 'Imported discussions with the agent',
    icon: IconMessages,
  },
  {
    to: '/changes/$changeId/design-docs',
    label: 'Design docs',
    description: 'The design documents of this change',
    icon: IconPencilBolt,
  },
];

const DOCUMENTATION_ENTRIES: {
  to: '/system-model' | '/wiki';
  label: string;
  description: string;
  icon: ComponentType<IconProps>;
}[] = [
  {
    to: '/system-model',
    label: 'System model',
    description: 'What the code is made of',
    icon: IconTopologyStar3,
  },
  {
    to: '/wiki',
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
  const matchRoute = useMatchRoute();

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
              active={Boolean(matchRoute({ to: entry.to, params }))}
              onClick={onNavigate}
              renderRoot={(props) => (
                <Link {...props} to={entry.to} params={params} />
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
            active={Boolean(matchRoute({ to: entry.to }))}
            onClick={onNavigate}
            renderRoot={(props) => <Link {...props} to={entry.to} />}
          />
        ))}
      </AppShell.Section>
    </>
  );
}
