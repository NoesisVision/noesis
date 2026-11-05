import { Box } from '#/shared/design-system/box.tsx';
import { UnstyledButton } from '#/shared/design-system/unstyled-button.tsx';
import type { AgentSession } from '#backend/app/agent/agent-session.ts';
import { useAgentPanel } from '../agent-panel-context.tsx';
import { AgentIcon } from '../agent.model.ts';
import { AgentComposer } from './agent-composer.tsx';
import {
  AgentConversationHeader,
  AgentStatusBadge,
  AgentTranscript,
} from './agent-conversation.tsx';
import classes from './agent-surface.module.css';

/**
 * The agent as a card floating over the page's bottom right corner, resized
 * from its corner; folded, a pill there with the status, which opens it
 * again. Nothing on the page moves for it.
 */
export function AgentCard({ session }: { session: AgentSession | undefined }) {
  const { opened, open } = useAgentPanel();
  const status = session?.status ?? 'starting';
  const unavailable = status === 'failed' || status === 'stopped';

  if (!opened) {
    return (
      <UnstyledButton
        className={classes.pill}
        onClick={open}
        aria-label="Open the agent"
      >
        <AgentIcon size={16} stroke={1.8} aria-hidden />
        <span>Agent</span>
        <AgentStatusBadge status={status} />
      </UnstyledButton>
    );
  }

  return (
    <Box component="section" aria-label="Agent" className={classes.card}>
      <AgentConversationHeader status={status} foldLabel="Fold to a pill" />
      <AgentTranscript session={session} />
      <AgentComposer
        layout="card"
        busy={status === 'working'}
        disabled={session === undefined || unavailable}
      />
    </Box>
  );
}
