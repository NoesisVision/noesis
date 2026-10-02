import { useQuery } from '@tanstack/react-query';
import { LoadingPanel } from '#/shared/ui/loading-panel.tsx';
import type { SelectSource } from '#/shared/ui/model-tree/use-model-tree.ts';
import { designDocById } from '../design-docs.api.ts';
import type { DesignDocViewName } from '../design-docs.model.ts';
import { DesignDocWorkbench } from './design-doc-workbench.tsx';
import {
  type RequirementsPlace,
  RequirementsView,
} from './requirements-view.tsx';
import { ViewSwitch } from './view-switch.tsx';

export interface DesignDocDetailProps {
  changeId: string;
  id: string;
  /** Whether the document is read as a model or as requirements. */
  view: DesignDocViewName;
  onView: (view: DesignDocViewName) => void;
  /** The element in hand, as the address names it; null for the top. */
  node: string | null;
  query: string;
  onSelect: (path: string, source: SelectSource) => void;
  onQuery: (query: string) => void;
  /** Where the reader is in the requirements, as the address names it. */
  requirements: RequirementsPlace;
}

export function DesignDocDetail({
  changeId,
  id,
  view,
  onView,
  requirements,
  ...reading
}: DesignDocDetailProps) {
  const document = useQuery(designDocById(changeId, id));
  // `isSuccess` is what narrows the data; the error state throws instead of
  // rendering, so nothing else is left to be in.
  if (!document.isSuccess)
    return <LoadingPanel label="Loading design document…" />;
  const switcher = <ViewSwitch view={view} onView={onView} />;
  // Either view's state is all about the document open, so another document
  // is another view rather than the same one told to change.
  if (view === 'requirements')
    return (
      <RequirementsView
        key={id}
        changeId={changeId}
        detail={document.data}
        switcher={switcher}
        {...requirements}
      />
    );
  return (
    <DesignDocWorkbench
      key={id}
      detail={document.data}
      switcher={switcher}
      {...reading}
    />
  );
}
