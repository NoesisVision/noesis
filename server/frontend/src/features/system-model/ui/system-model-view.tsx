import { useQuery } from '@tanstack/react-query';
import { describeFailure } from '#/shared/api/failure.ts';
import { Alert } from '#/shared/design-system/alert.tsx';
import { Button } from '#/shared/design-system/button.tsx';
import { Group } from '#/shared/design-system/group.tsx';
import { Stack } from '#/shared/design-system/stack.tsx';
import { Text } from '#/shared/design-system/text.tsx';
import { FormattedDate } from '#/shared/ui/formatted-date.tsx';
import { LoadingPanel } from '#/shared/ui/loading-panel.tsx';
import { StatusPanel } from '#/shared/ui/status-panel.tsx';
import {
  newestSystemModel,
  type SystemModelSummary,
  useScanSystemModel,
} from '../system-model.api.ts';

/**
 * The newest scan of the repository and the button that runs the next one,
 * with the scanner the repository's `noesis-config.json` names.
 */
export function SystemModelView() {
  const newest = useQuery(newestSystemModel);
  const scan = useScanSystemModel();

  if (newest.isPending)
    return <LoadingPanel label="Loading the system model…" />;
  if (newest.isError) throw newest.error;

  const scanButton = (
    <Button busy={scan.isPending} onClick={() => scan.mutate()}>
      {newest.data === null ? 'Scan' : 'Scan again'}
    </Button>
  );
  const outcome = (
    <>
      {scan.isPending && (
        <Text component="output" c="dimmed">
          Scanning the repository…
        </Text>
      )}
      {scan.isError && (
        <Alert color="red" title="The scan failed">
          {describeFailure(scan.error).description}
        </Alert>
      )}
    </>
  );

  if (newest.data === null) {
    return (
      <>
        <StatusPanel
          headingLevel={2}
          title="No system model is scanned yet"
          description="Scan the repository to see what the code is made of."
          action={scanButton}
        />
        {outcome}
      </>
    );
  }
  return (
    <Stack>
      <Group justify="space-between" align="flex-start">
        <NewestScan systemModel={newest.data} />
        {scanButton}
      </Group>
      {outcome}
    </Stack>
  );
}

function NewestScan({ systemModel }: { systemModel: SystemModelSummary }) {
  return (
    <Stack gap={4}>
      <Text fw={600}>{systemModel.name}</Text>
      <Text c="dimmed" size="sm">
        Scanned <FormattedDate value={systemModel.scanned_at} />
      </Text>
      <Text size="sm">
        {systemModel.modules} modules, {systemModel.buildingBlocks} building
        blocks, {systemModel.behaviours} behaviours
      </Text>
    </Stack>
  );
}
