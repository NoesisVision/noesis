import { useQuery } from '@tanstack/react-query';
import { getRouteApi } from '@tanstack/react-router';
import { type ReactNode, useCallback, useMemo } from 'react';
import {
  ModelReader,
  type SelectSource,
} from '#/features/design-docs/model-reader.ts';
import { describeFailure } from '#/shared/api/failure.ts';
import { Alert } from '#/shared/design-system/alert.tsx';
import { Button } from '#/shared/design-system/button.tsx';
import { Group } from '#/shared/design-system/group.tsx';
import { Text } from '#/shared/design-system/text.tsx';
import { FormattedDate } from '#/shared/ui/formatted-date.tsx';
import { LoadingPanel } from '#/shared/ui/loading-panel.tsx';
import { StatusPanel } from '#/shared/ui/status-panel.tsx';
import type { SystemModel } from '#backend/app/system-model/system-model.ts';
import { newestSystemModel, useScanSystemModel } from '../system-model.api.ts';
import { designOf } from '../system-model.model.ts';
import classes from './system-model-view.module.css';

const route = getRouteApi('/_shell/system-model');

/**
 * The model scanned last, read as a design's model is read but as it stands:
 * the tree and the element in hand, nothing to move or write. Scanning again
 * replaces it with what the code holds now.
 */
export function SystemModelView() {
  const query = useQuery(newestSystemModel);
  const scan = useScanSystemModel();
  const scanButton = (
    <Button loading={scan.isPending} onClick={() => scan.mutate()}>
      Scan
    </Button>
  );

  if (query.isPending)
    return <LoadingPanel label="Loading the system model…" />;
  const failure = scan.isError ? describeFailure(scan.error) : null;
  return (
    <div className={classes.surface}>
      {failure !== null && (
        <Alert color="red" title={failure.title}>
          {failure.description}
        </Alert>
      )}
      {query.data ? (
        <ScannedModel
          key={query.data.id}
          model={query.data}
          action={scanButton}
        />
      ) : (
        <StatusPanel
          headingLevel={2}
          title="No system model is scanned yet"
          description="Scan the repository's code to read its modules, building blocks and behaviours."
          action={scanButton}
        />
      )}
    </div>
  );
}

function ScannedModel({
  model,
  action,
}: {
  model: SystemModel;
  action: ReactNode;
}) {
  const document = useMemo(() => designOf(model), [model]);
  const place = usePlace();
  return (
    <>
      <Group justify="space-between" wrap="nowrap" className={classes.header}>
        <Text c="dimmed" size="sm">
          <Text component="span" inherit fw={700} c="var(--mantine-color-text)">
            {model.name}
          </Text>
          {' · scanned '}
          <FormattedDate value={model.scanned_at} />
        </Text>
        {action}
      </Group>
      <ModelReader document={document} {...place} />
    </>
  );
}

/** The row in hand and what is looked for, kept in the address as a design's are. */
function usePlace() {
  const { node, q } = route.useSearch();
  const navigate = route.useNavigate();
  const onSelect = useCallback(
    (next: string, source: SelectSource) => {
      void navigate({
        search: (prev) => ({ ...prev, node: next === '' ? undefined : next }),
        replace: source === 'init',
      });
    },
    [navigate],
  );
  const onQuery = useCallback(
    (next: string) => {
      void navigate({
        search: (prev) => ({ ...prev, q: next === '' ? undefined : next }),
        replace: true,
      });
    },
    [navigate],
  );
  return { selected: node ?? null, query: q ?? '', onSelect, onQuery };
}
