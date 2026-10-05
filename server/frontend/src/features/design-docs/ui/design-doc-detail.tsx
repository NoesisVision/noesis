import { useQuery } from '@tanstack/react-query';
import { LoadingPanel } from '#/shared/ui/loading-panel.tsx';
import { designDocById } from '../design-docs.api.ts';
import type { DesignDocViewName } from '../design-docs.model.ts';
import { ArchitectureView } from './architecture/architecture-view.tsx';
import { DesignDocSurface } from './design-doc-surface.tsx';
import { DesignDocWorkbench } from './design-doc-workbench.tsx';
import { RequirementsView } from './requirements/requirements-view.tsx';
import type { ViewPlace } from './view-place.ts';
import { ViewSwitch } from './view-switch.tsx';

export interface DesignDocDetailProps {
  changeId: string;
  id: string;
  /** Whether the document is read as a model, as requirements or as hexagons. */
  view: DesignDocViewName;
  onView: (view: DesignDocViewName) => void;
  /** Where the reader is in the model, as the address names it. */
  model: ViewPlace;
  /** Where the reader is in the requirements, as the address names it. */
  requirements: ViewPlace;
  /** Where the reader is in the architecture, as the address names it. */
  architecture: ViewPlace;
}

export function DesignDocDetail({
  changeId,
  id,
  view,
  onView,
  model,
  requirements,
  architecture,
}: DesignDocDetailProps) {
  const document = useQuery(designDocById(changeId, id));
  // `isSuccess` is what narrows the data; the error state throws instead of
  // rendering, so nothing else is left to be in.
  if (!document.isSuccess)
    return <LoadingPanel label="Loading design document…" />;
  // One frame for every view, so switching changes what is in it and leaves
  // it standing — full screen included. Each view's state is all about the
  // document open, so another document is another view rather than the same
  // one told to change.
  return (
    <DesignDocSurface
      document={document.data.document}
      switcher={<ViewSwitch view={view} onView={onView} />}
    >
      {view === 'requirements' ? (
        <RequirementsView
          key={id}
          changeId={changeId}
          detail={document.data}
          {...requirements}
        />
      ) : view === 'architecture' ? (
        <ArchitectureView key={id} detail={document.data} {...architecture} />
      ) : (
        <DesignDocWorkbench key={id} detail={document.data} {...model} />
      )}
    </DesignDocSurface>
  );
}
