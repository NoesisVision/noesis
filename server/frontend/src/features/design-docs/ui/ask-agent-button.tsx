import { useAgentPanel } from '#/features/agent/agent-panel-context.tsx';
import { AgentIcon } from '#/features/agent/agent.model.ts';
import { Button } from '#/shared/design-system/button.tsx';

/**
 * Hands a design document's work to the agent: opens its panel with the
 * skill's invocation written in the composer, for the person to add to and
 * send.
 */
export function AskAgentButton({
  prompt,
  children,
}: {
  prompt: string;
  children: string;
}) {
  const { open } = useAgentPanel();
  return (
    <Button
      variant="light"
      size="xs"
      leftSection={<AgentIcon size={14} aria-hidden />}
      onClick={() => open(prompt)}
    >
      {children}
    </Button>
  );
}
