import { IconShieldQuestion } from '@tabler/icons-react';
import { Box } from '#/shared/design-system/box.tsx';
import { Button } from '#/shared/design-system/button.tsx';
import { Code } from '#/shared/design-system/code.tsx';
import { Group } from '#/shared/design-system/group.tsx';
import { Stack } from '#/shared/design-system/stack.tsx';
import { Text } from '#/shared/design-system/text.tsx';
import type {
  AgentEntry,
  PermissionDecision,
} from '#backend/app/agent/agent-session.ts';
import { useDecideAgentPermission } from '../agent.api.ts';
import { toolLabel } from '../agent.model.ts';
import classes from './agent-entry.module.css';

type PermissionEntry = Extract<AgentEntry, { kind: 'permission' }>;

/**
 * A tool the agent may not run without the person: what it is and what it
 * is about, and the three answers Claude Code itself offers.
 */
export function AgentPermissionCard({ entry }: { entry: PermissionEntry }) {
  const decide = useDecideAgentPermission();
  const choose = (decision: PermissionDecision) =>
    decide.mutate({ toolUseId: entry.toolUseId, decision });
  const problem = decide.error === null ? null : decide.error.message;
  const what = (
    <Box>
      <Text size="sm" fw={500}>
        {toolLabel(entry.tool)}
      </Text>
      {entry.detail !== '' && (
        <Code block fz={11} mt={4} className={classes.detail}>
          {entry.detail}
        </Code>
      )}
    </Box>
  );

  // Decided, it says nothing more: the tool's own line above it shows what
  // ran, or failed to.
  if (entry.decision !== null) return null;

  return (
    <Box className={classes.ask}>
      <Stack gap="sm">
        <Group gap={6} wrap="nowrap">
          <IconShieldQuestion size={14} aria-hidden />
          <Text className={classes.askHeader}>May the agent run this?</Text>
        </Group>
        {what}
        {problem !== null && (
          <Text size="xs" c="red" role="alert">
            {problem}
          </Text>
        )}
        <Group gap="xs" justify="flex-end">
          <Button
            size="xs"
            variant="subtle"
            color="red"
            onClick={() => choose('deny')}
            disabled={decide.isPending}
          >
            Refuse
          </Button>
          <Button
            size="xs"
            variant="light"
            onClick={() => choose('allowAlways')}
            disabled={decide.isPending}
          >
            Allow for this session
          </Button>
          <Button
            size="xs"
            onClick={() => choose('allow')}
            busy={decide.isPending}
          >
            Allow once
          </Button>
        </Group>
      </Stack>
    </Box>
  );
}
