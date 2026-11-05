import { IconX } from '@tabler/icons-react';
import { useEffect, useRef } from 'react';
import { useChangeId } from '#/features/changes/current-change.ts';
import { ActionIcon } from '#/shared/design-system/action-icon.tsx';
import { Alert } from '#/shared/design-system/alert.tsx';
import { Badge } from '#/shared/design-system/badge.tsx';
import { Box } from '#/shared/design-system/box.tsx';
import { Button } from '#/shared/design-system/button.tsx';
import { Group } from '#/shared/design-system/group.tsx';
import { Loader } from '#/shared/design-system/loader.tsx';
import { ScrollArea } from '#/shared/design-system/scroll-area.tsx';
import { Stack } from '#/shared/design-system/stack.tsx';
import { Text } from '#/shared/design-system/text.tsx';
import { ThemeIcon } from '#/shared/design-system/theme-icon.tsx';
import { Title } from '#/shared/design-system/title.tsx';
import { Tooltip } from '#/shared/design-system/tooltip.tsx';
import type { AgentSession } from '#backend/app/agent/agent-session.ts';
import { useAgentPanel } from '../agent-panel-context.tsx';
import { useAgentSession } from '../agent.api.ts';
import {
  AGENT_STATUS_META,
  AgentIcon,
  createDesignDocPrompt,
} from '../agent.model.ts';
import { AgentComposer } from './agent-composer.tsx';
import { AgentEntryView } from './agent-entry.tsx';
import classes from './agent-panel.module.css';

/**
 * The agent beside the page: the session's state at the head, the
 * conversation in the middle, the composer at the foot. One Claude Code
 * session for the whole page, however the page is read.
 */
export function AgentPanel() {
  const { close } = useAgentPanel();
  const { data: session } = useAgentSession();
  const status = session?.status ?? 'starting';
  const meta = AGENT_STATUS_META[status];
  const unavailable = status === 'failed' || status === 'stopped';

  return (
    <Box component="aside" aria-label="Agent" className={classes.aside}>
      <Box className={classes.card}>
        <Group justify="space-between" wrap="nowrap" className={classes.header}>
          <Group gap="sm" wrap="nowrap">
            <ThemeIcon variant="light" size="md" radius="md" aria-hidden>
              <AgentIcon size={18} stroke={1.7} />
            </ThemeIcon>
            <Title order={2} className={classes.title}>
              Agent
            </Title>
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
          </Group>
          <Tooltip label="Close the agent panel">
            <ActionIcon
              variant="subtle"
              color="gray"
              aria-label="Close the agent panel"
              onClick={close}
            >
              <IconX size={16} aria-hidden />
            </ActionIcon>
          </Tooltip>
        </Group>
        <Transcript session={session} />
        <AgentComposer
          busy={status === 'working'}
          disabled={session === undefined || unavailable}
        />
      </Box>
    </Box>
  );
}

function Transcript({ session }: { session: AgentSession | undefined }) {
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
          <Welcome mode={session?.mode} />
        )}
        {entries.map((entry) => (
          <AgentEntryView key={entry.id} entry={entry} />
        ))}
        <div ref={end} />
      </Box>
    </ScrollArea>
  );
}

/** Before anything is said: what the agent is for, and the one thing it does best here. */
function Welcome({ mode }: { mode: AgentSession['mode'] | undefined }) {
  const { open } = useAgentPanel();
  const { changeId } = useChangeId();
  return (
    <Stack gap="sm" py="md">
      <Text size="sm" c="dimmed">
        {mode === 'attached'
          ? 'This is the Claude Code session that started Noesis.'
          : 'Claude Code, running beside this page with the Noesis plugin. Ask it to design a change, revise a design document or add material to a change.'}
      </Text>
      {changeId !== null && (
        <Button
          variant="light"
          size="xs"
          leftSection={<AgentIcon size={14} aria-hidden />}
          onClick={() => open(createDesignDocPrompt(changeId))}
        >
          Design this change
        </Button>
      )}
    </Stack>
  );
}
