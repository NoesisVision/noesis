import {
  IconAffiliate,
  IconBinaryTree2,
  IconInfoCircle,
} from '@tabler/icons-react';
import { useQuery } from '@tanstack/react-query';
import { getRouteApi } from '@tanstack/react-router';
import { useCallback, useMemo } from 'react';
import {
  ModelReader,
  type SelectSource,
} from '#/features/design-docs/model-reader.ts';
import { describeFailure } from '#/shared/api/failure.ts';
import { ActionIcon } from '#/shared/design-system/action-icon.tsx';
import { Alert } from '#/shared/design-system/alert.tsx';
import { Button } from '#/shared/design-system/button.tsx';
import { Group } from '#/shared/design-system/group.tsx';
import { SegmentedControl } from '#/shared/design-system/segmented-control.tsx';
import { Tooltip } from '#/shared/design-system/tooltip.tsx';
import { VisuallyHidden } from '#/shared/design-system/visually-hidden.tsx';
import { FormattedDate } from '#/shared/ui/formatted-date.tsx';
import { LoadingPanel } from '#/shared/ui/loading-panel.tsx';
import { PageHeading } from '#/shared/ui/page-heading.tsx';
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
 *
 * Headed as every page is, its controls on the title's line: what was
 * scanned and when behind an "i", the way to read it, and scanning again.
 */
export function SystemModelView() {
  const query = useQuery(newestSystemModel);
  const scan = useScanSystemModel();
  const { view, onView } = useView();
  const scanButton = (
    <Button loading={scan.isPending} onClick={() => scan.mutate()}>
      Scan
    </Button>
  );
  const model = query.data ?? null;
  const failure = scan.isError ? describeFailure(scan.error) : null;
  return (
    <div className={classes.surface}>
      <Group justify="space-between" gap="md" className={classes.header}>
        <PageHeading
          title="System model"
          eyebrow="System model"
          meta="What the code is made of"
          tone="brand"
        />
        <Group gap="sm" wrap="nowrap" className={classes.controls}>
          {model !== null && (
            <>
              <ScanDetails model={model} />
              <SegmentedControl
                aria-label="Read the system model as"
                value={view}
                data={VIEWS}
                onChange={(value) => {
                  if (isSystemModelView(value)) onView(value);
                }}
              />
            </>
          )}
          {!query.isPending && scanButton}
        </Group>
      </Group>
      {failure !== null && (
        <Alert color="red" title={failure.title}>
          {failure.description}
        </Alert>
      )}
      {query.isPending ? (
        <LoadingPanel label="Loading the system model…" />
      ) : model !== null ? (
        <ScannedModel key={model.id} model={model} view={view} />
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

/**
 * When the model was scanned, behind an "i" beside the controls; which
 * project it is, the top bar says. The button is named by the same words, so
 * a reader who cannot point at it still hears them.
 */
function ScanDetails({ model }: { model: SystemModel }) {
  const details = (
    <>
      {'Scanned '}
      <FormattedDate value={model.scanned_at} />
    </>
  );
  return (
    <Tooltip label={details} position="bottom">
      <ActionIcon variant="subtle" color="gray" size={34}>
        <IconInfoCircle size={18} stroke={1.7} aria-hidden />
        <VisuallyHidden>{details}</VisuallyHidden>
      </ActionIcon>
    </Tooltip>
  );
}

function ScannedModel({
  model,
  view,
}: {
  model: SystemModel;
  view: SystemModelViewName;
}) {
  const document = useMemo(() => designOf(model), [model]);
  const place = usePlace();
  return view === 'exploration' ? (
    <ExplorationView
      // Afresh for each scan: its diagram and its steps are its own.
      key={model.id}
      model={model}
    />
  ) : (
    <ModelReader document={document} {...place} />
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
