import {
  IconChevronDown,
  IconLayoutBottombar,
  IconPictureInPicture,
} from '@tabler/icons-react';
import { useEffect, useRef } from 'react';
import { ActionIcon } from '#/shared/design-system/action-icon.tsx';
import { Alert } from '#/shared/design-system/alert.tsx';
import { Badge } from '#/shared/design-system/badge.tsx';
import { Box } from '#/shared/design-system/box.tsx';
import { Group } from '#/shared/design-system/group.tsx';
import { Loader } from '#/shared/design-system/loader.tsx';
import { ScrollArea } from '#/shared/design-system/scroll-area.tsx';
import { Text } from '#/shared/design-system/text.tsx';
import { ThemeIcon } from '#/shared/design-system/theme-icon.tsx';
import { Title } from '#/shared/design-system/title.tsx';
import { Tooltip } from '#/shared/design-system/tooltip.tsx';
import type { AgentSession } from '#backend/app/agent/agent-session.ts';
import { type AgentPlacement, useAgentPanel } from '../agent-panel-context.tsx';
import { AGENT_STATUS_META, AgentIcon } from '../agent.model.ts';
import { AgentEntryView } from './agent-entry.tsx';
import classes from './agent-surface.module.css';

const PLACEMENTS: {
  value: AgentPlacement;
  label: string;
  icon: typeof IconLayoutBottombar;
}[] = [
  {
    value: 'bar',
    label: 'Dock at the foot of the page',
    icon: IconLayoutBottombar,
  },
  { value: 'card', label: 'Float as a card', icon: IconPictureInPicture },
];

/** The session's status, as a word in its colour; moving while the agent works. */
export function AgentStatusBadge({
  status,
}: {
  status: AgentSession['status'];
}) {
  const meta = AGENT_STATUS_META[status];
  return (
    <Badge
      variant="light"
      color={meta.color}
      size="sm"
      aria-live="polite"
      leftSection={
        meta.busy ? <Loader size={8} color={meta.color} /> : undefined
      }
    >
      {meta.label}
    </Badge>
  );
}

/**
 * The head of the conversation wherever it is shown: what it is, how the
 * session stands, where to put it, and the way to fold it away.
 */
export function AgentConversationHeader({
  status,
  foldLabel,
}: {
  status: AgentSession['status'];
  /** What folding does here: the sheet goes down, the card becomes a pill. */
  foldLabel: string;
}) {
  const { placement, setPlacement, close } = useAgentPanel();
  return (
    <Group justify="space-between" wrap="nowrap" className={classes.header}>
      <Group gap="sm" wrap="nowrap">
        <ThemeIcon variant="light" size="md" radius="md" aria-hidden>
          <AgentIcon size={18} stroke={1.7} />
        </ThemeIcon>
        <Title order={2} className={classes.title}>
          Agent
        </Title>
        <AgentStatusBadge status={status} />
      </Group>
      <Group gap={2} wrap="nowrap">
        {PLACEMENTS.map((option) => (
          <Tooltip key={option.value} label={option.label}>
            <ActionIcon
              variant={placement === option.value ? 'light' : 'subtle'}
              color="gray"
              size="md"
              aria-label={option.label}
              aria-pressed={placement === option.value}
              onClick={() => setPlacement(option.value)}
            >
              <option.icon size={16} stroke={1.7} aria-hidden />
            </ActionIcon>
          </Tooltip>
        ))}
        <Tooltip label={foldLabel}>
          <ActionIcon
            variant="subtle"
            color="gray"
            size="md"
            aria-label={foldLabel}
            onClick={close}
          >
            <IconChevronDown size={16} aria-hidden />
          </ActionIcon>
        </Tooltip>
      </Group>
    </Group>
  );
}

/** The conversation so far, following its end as it grows. */
export function AgentTranscript({
  session,
}: {
  session: AgentSession | undefined;
}) {
  const end = useRef<HTMLDivElement>(null);
  const entries = session?.entries ?? [];
  const last = entries.at(-1);
  const lastText = last?.kind === 'assistant' ? last.text : undefined;
  // Follows the conversation as it grows, as a chat does; no CSS keeps a
  // scroll at its end while the content above it changes.
  useEffect(() => {
    end.current?.scrollIntoView({ block: 'end' });
  }, [entries.length, lastText]);

  return (
    <ScrollArea className={classes.transcript} type="hover">
      {/* A log: what arrives is read out as it comes, without taking the focus. */}
      <Box className={classes.entries} role="log" aria-live="polite">
        {session?.hint && (
          <Alert
            variant="light"
            color={session.status === 'failed' ? 'red' : 'gray'}
            radius="md"
            p="sm"
          >
            <Text size="xs">{session.hint}</Text>
          </Alert>
        )}
        {entries.length === 0 && session?.status !== 'failed' && (
          <Text size="sm" c="dimmed" py="md">
            {session?.mode === 'attached'
              ? 'This is the Claude Code session that started Noesis.'
              : 'Claude Code, running beside this page with the Noesis plugin. On a change, your words design a document into it; on a design document, they revise it.'}
          </Text>
        )}
        {entries.map((entry) => (
          <AgentEntryView key={entry.id} entry={entry} />
        ))}
        <div ref={end} />
      </Box>
    </ScrollArea>
  );
}
