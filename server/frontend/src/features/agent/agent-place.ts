import { useMatch, useParams } from '@tanstack/react-router';
import { useDiagramApplier } from '#/features/system-model/diagram-applier.tsx';
import type { AgentTask } from '#backend/app/agent/agent-task.ts';

/**
 * Where the page is, as the agent needs to know it: on a change, with a
 * design document open or not, or on the system model's diagram. Off every
 * one of these the agent has nothing to do, and is not drawn.
 */
export function useAgentPlace(): {
  shown: boolean;
  task: () => AgentTask | undefined;
} {
  const { changeId, docId } = useParams({ strict: false });
  const onSystemModel =
    useMatch({ from: '/_shell/system-model', shouldThrow: false }) !==
    undefined;
  const { applier } = useDiagramApplier();
  const task = (): AgentTask | undefined => {
    if (changeId !== undefined) {
      return {
        kind: 'design',
        change: changeId,
        ...(docId === undefined ? {} : { designDoc: docId }),
      } as AgentTask;
    }
    if (onSystemModel && applier !== null)
      return { kind: 'diagram', diagram: applier.snapshot() };
    return undefined;
  };
  return { shown: changeId !== undefined || onSystemModel, task };
}
