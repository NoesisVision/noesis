import { useQuery } from '@tanstack/react-query';
import { LoadingPanel } from '#/shared/ui/loading-panel.tsx';
import { designDocById } from '../design-docs.api.ts';
import { DesignDocWorkbench } from './design-doc-workbench.tsx';

export interface DesignDocDetailProps {
  changeId: string;
  id: string;
  /** The element in hand, as the address names it; null for the top. */
  node: string | null;
  query: string;
  onSelect: (path: string) => void;
  onQuery: (query: string) => void;
}

export function DesignDocDetail({
  changeId,
  id,
  ...reading
}: DesignDocDetailProps) {
  const document = useQuery(designDocById(changeId, id));
  // `isSuccess` is what narrows the data; the error state throws instead of
  // rendering, so nothing else is left to be in.
  if (!document.isSuccess)
    return <LoadingPanel label="Loading design document…" />;
  // The workbench's state is all about the document open, so another document
  // is another workbench rather than the same one told to change.
  return <DesignDocWorkbench key={id} detail={document.data} {...reading} />;
}
