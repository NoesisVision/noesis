import { useQuery } from '@tanstack/react-query';
import { useMemo, useState } from 'react';
import { ExplorationView } from '#/features/system-model/system-model-explorer.ts';
import { newestSystemModel } from '#/features/system-model/system-model.api.ts';
import { Text } from '#/shared/design-system/text.tsx';
import { LoadingPanel } from '#/shared/ui/loading-panel.tsx';
import type { DesignDocumentInput } from '#backend/app/design-docs/design-doc.ts';
import type { SystemModel } from '#backend/app/system-model/system-model.ts';
import { opensOnOf, overlayOf } from '../../design-doc-overlay.ts';
import type { DesignDocDetail } from '../../design-docs.api.ts';

/*
 * The design explored as the system model is: drawn among the elements of
 * the model it changes, the newest scan with the design laid over it. It
 * opens on what the design touches and what holds it; the reader brings in
 * the rest of the model around it, by name, by relation, by slot, as on the
 * system model's own exploration. The diagram is kept for the document,
 * apart from any scan's.
 *
 * Mount it under the document's id, as the other views are.
 */
export function DesignDocExploration({
  changeId,
  detail,
}: {
  changeId: string;
  detail: DesignDocDetail;
}) {
  const scanned = useQuery(newestSystemModel);
  if (scanned.isPending)
    return <LoadingPanel label="Loading the system model…" />;
  const model = scanned.data ?? null;
  return (
    <>
      {model === null && (
        <Text size="sm" c="dimmed">
          No system model is scanned yet, so only the design is drawn. Scan the
          system model to bring in what the design touches.
        </Text>
      )}
      <OverlaidExploration
        // A new scan is another model under the design: drawn afresh.
        key={model?.id ?? 'no-scan'}
        changeId={changeId}
        document={detail.document}
        model={model ?? noScanOf(detail.document)}
      />
    </>
  );
}

function OverlaidExploration({
  changeId,
  document,
  model,
}: {
  changeId: string;
  document: DesignDocumentInput;
  model: SystemModel;
}) {
  // Redrawn as the design is edited, in this view or another, without
  // starting the diagram again.
  const overlay = useMemo(() => overlayOf(model, document), [model, document]);
  // What it opens on is read once: a diagram with steps kept opens on those.
  const [opensOn] = useState(() => opensOnOf(document, overlay));
  return (
    <ExplorationView
      model={overlay.model}
      diagramId={`design-doc.${changeId}.${document.id}`}
      opensOn={opensOn}
    />
  );
}

/** The model under a design when nothing is scanned: none, so the design is drawn alone. */
const noScanOf = (document: DesignDocumentInput): SystemModel => ({
  id: '' as SystemModel['id'],
  name: document.name,
  scanned_at: '',
  commit: null,
  modules: [],
  buildingBlocks: [],
  behaviors: [],
  rules: [],
  scenarios: [],
  actors: [],
  manualProcesses: [],
  deployableUnits: [],
  libraries: [],
  layers: [],
  deploymentContainers: [],
  relations: [],
});
