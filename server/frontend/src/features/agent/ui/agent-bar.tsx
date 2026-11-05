import { IconChevronUp } from '@tabler/icons-react';
import { useId } from 'react';
import { ActionIcon } from '#/shared/design-system/action-icon.tsx';
import { Box } from '#/shared/design-system/box.tsx';
import { Tooltip } from '#/shared/design-system/tooltip.tsx';
import type { AgentSession } from '#backend/app/agent/agent-session.ts';
import { useAgentPanel } from '../agent-panel-context.tsx';
import { AgentComposer } from './agent-composer.tsx';
import {
  AgentConversationHeader,
  AgentStatusBadge,
  AgentTranscript,
} from './agent-conversation.tsx';
import classes from './agent-surface.module.css';

/**
 * The agent as a line at the foot of the page: the task, the field, the
 * status. The conversation rises over the page as a sheet while there is
 * something to read or decide, and goes down again at a click.
 */
export function AgentBar({ session }: { session: AgentSession | undefined }) {
  const { opened, toggle } = useAgentPanel();
  const sheetId = useId();
  const status = session?.status ?? 'starting';
  const unavailable = status === 'failed' || status === 'stopped';
  const showLabel = opened ? 'Fold the conversation' : 'Show the conversation';

  return (
    <Box component="section" aria-label="Agent" className={classes.foot}>
      {opened && (
        <Box id={sheetId} className={classes.sheet}>
          <AgentConversationHeader
            status={status}
            foldLabel="Fold the conversation"
          />
          <AgentTranscript session={session} />
        </Box>
      )}
      <Box className={classes.bar}>
        <AgentComposer
          layout="bar"
          busy={status === 'working'}
          disabled={session === undefined || unavailable}
          trailing={
            <>
              <AgentStatusBadge status={status} />
              <Tooltip label={showLabel}>
                <ActionIcon
                  variant="subtle"
                  color="gray"
                  size="md"
                  aria-label={showLabel}
                  aria-expanded={opened}
                  aria-controls={sheetId}
                  onClick={toggle}
                >
                  <IconChevronUp
                    size={16}
                    aria-hidden
                    className={classes.chevron}
                    data-open={opened || undefined}
                  />
                </ActionIcon>
              </Tooltip>
            </>
          }
        />
      </Box>
    </Box>
  );
}
