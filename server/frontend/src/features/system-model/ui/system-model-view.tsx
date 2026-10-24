import { IconAffiliate, IconBinaryTree2 } from '@tabler/icons-react';
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
import { SegmentedControl } from '#/shared/design-system/segmented-control.tsx';
import { Text } from '#/shared/design-system/text.tsx';
import { FormattedDate } from '#/shared/ui/formatted-date.tsx';
import { LoadingPanel } from '#/shared/ui/loading-panel.tsx';
import { StatusPanel } from '#/shared/ui/status-panel.tsx';
import { titleCase } from '#/shared/ui/title-case.ts';
import type { SystemModel } from '#backend/app/system-model/system-model.ts';
import { newestSystemModel, useScanSystemModel } from '../system-model.api.ts';
import {
  designOf,
  isSystemModelView,
  SYSTEM_MODEL_VIEWS,
  type SystemModelViewName,
} from '../system-model.model.ts';
import { ExplorationView } from './exploration/exploration-view.tsx';
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
  const { view, onView } = useView();
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
        <Group gap="sm" wrap="nowrap">
          <SegmentedControl
            aria-label="Read the system model as"
            value={view}
            data={VIEWS}
            onChange={(value) => {
              if (isSystemModelView(value)) onView(value);
            }}
          />
          {action}
        </Group>
      </Group>
      {view === 'exploration' ? (
        <ExplorationView
          // Afresh for each scan: its diagram and its steps are its own.
          key={model.id}
          model={model}
        />
      ) : (
        <ModelReader document={document} {...place} />
      )}
    </>
  );
}

const VIEW_ICONS = {
  model: IconBinaryTree2,
  exploration: IconAffiliate,
} as const satisfies Record<SystemModelViewName, unknown>;

/** Each view by its icon and its name, written out. */
const VIEWS = SYSTEM_MODEL_VIEWS.map((value) => {
  const Icon = VIEW_ICONS[value];
  return {
    value,
    label: (
      <Group gap={6} wrap="nowrap">
        <Icon size={16} stroke={1.6} aria-hidden />
        {titleCase(value)}
      </Group>
    ),
  };
});

/** Which way the model is read, kept in the address; none is the model tree. */
function useView() {
  const { view } = route.useSearch();
  const navigate = route.useNavigate();
  const onView = useCallback(
    (next: SystemModelViewName) => {
      void navigate({
        search: (prev) => ({
          ...prev,
          view: next === 'exploration' ? next : undefined,
        }),
      });
    },
    [navigate],
  );
  return { view: view ?? ('model' as const), onView };
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
