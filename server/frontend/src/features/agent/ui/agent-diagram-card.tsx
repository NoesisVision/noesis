import { IconTopologyStar3 } from '@tabler/icons-react';
import { useEffect, useRef } from 'react';
import { useDiagramApplier } from '#/features/system-model/diagram-applier.tsx';
import { describeStep } from '#/features/system-model/diagram-plan.ts';
import { Box } from '#/shared/design-system/box.tsx';
import { Button } from '#/shared/design-system/button.tsx';
import { Group } from '#/shared/design-system/group.tsx';
import { List } from '#/shared/design-system/list.tsx';
import { Stack } from '#/shared/design-system/stack.tsx';
import { Text } from '#/shared/design-system/text.tsx';
import type { AgentEntry } from '#backend/app/agent/agent-session.ts';
import classes from './agent-entry.module.css';

type DiagramEntry = Extract<AgentEntry, { kind: 'diagram' }>;

/**
 * The steps the agent answered a diagram request with, said in words, and
 * what applying them did. Applied on its own once, as it arrives, when the
 * diagram is on the page; applied again at a click, and at all when the
 * diagram was not there to receive it.
 */
export function AgentDiagramCard({ entry }: { entry: DiagramEntry }) {
  const { applier, applyPlan, outcomes } = useDiagramApplier();
  const outcome = outcomes.get(entry.id);
  const appliedOnce = useRef(false);
  useEffect(() => {
    if (appliedOnce.current || applier === null) return;
    appliedOnce.current = true;
    applyPlan(entry.id, entry.plan);
  }, [applier, applyPlan, entry.id, entry.plan]);

  return (
    <Box className={classes.ask}>
      <Stack gap="sm">
        <Group gap={6} wrap="nowrap">
          <IconTopologyStar3 size={14} aria-hidden />
          <Text className={classes.askHeader}>Diagram steps</Text>
        </Group>
        <Text size="sm" fw={500}>
          {entry.plan.summary}
        </Text>
        <List size="sm" spacing={2} type="ordered">
          {entry.plan.steps.map((step, index) => (
            <List.Item key={index}>{describeStep(step, null)}</List.Item>
          ))}
        </List>
        {outcome !== undefined && (
          <Text size="xs" c={outcome.problems.length > 0 ? 'orange' : 'dimmed'}>
            Applied: {outcome.added} added, {outcome.removed} removed.
            {outcome.problems.length > 0 && ` ${outcome.problems.join(' ')}`}
          </Text>
        )}
        <Group justify="flex-end">
          <Button
            size="xs"
            variant={outcome === undefined ? 'filled' : 'light'}
            disabled={applier === null}
            onClick={() => applyPlan(entry.id, entry.plan)}
          >
            {outcome === undefined ? 'Apply to the diagram' : 'Apply again'}
          </Button>
        </Group>
        {applier === null && (
          <Text size="xs" c="dimmed">
            Open the system model to apply it.
          </Text>
        )}
      </Stack>
    </Box>
  );
}
