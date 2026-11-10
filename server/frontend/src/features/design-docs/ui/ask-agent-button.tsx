import { useAgentPanel } from '#/features/agent/agent-panel-context.tsx';
import { AgentIcon } from '#/features/agent/agent.model.ts';
import { Button } from '#/shared/design-system/button.tsx';

/** Opens the agent's panel beside the page, which already knows what the page is about. */
export function AskAgentButton({ children }: { children: string }) {
  const { open } = useAgentPanel();
  return (
    <Button
      variant="light"
      size="xs"
      leftSection={<AgentIcon size={14} aria-hidden />}
      onClick={open}
    >
      {children}
    </Button>
  );
}
