import { useQuery } from '@tanstack/react-query';
import { LoadingPanel } from '#/shared/ui/loading-panel.tsx';
import { designDocById } from '../design-docs.api.ts';
import { DesignDocWorkbench } from './design-doc-workbench.tsx';

export function DesignDocDetail({
  changeId,
  id,
}: {
  changeId: string;
  id: string;
}) {
  const query = useQuery(designDocById(changeId, id));
  // `isSuccess` is what narrows the data; the error state throws instead of
  // rendering, so nothing else is left to be in.
  if (!query.isSuccess)
    return <LoadingPanel label="Loading design document…" />;
  // The workbench's state is all about the document open, so another document
  // is another workbench rather than the same one told to change.
  return <DesignDocWorkbench key={id} detail={query.data} />;
}
