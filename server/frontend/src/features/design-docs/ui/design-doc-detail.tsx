import { useQuery } from '@tanstack/react-query';
import { LoadingPanel } from '#/shared/ui/loading-panel.tsx';
import { designDocById } from '../design-docs.api.ts';
import { DesignDocumentContent } from './design-document-content.tsx';

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
  return <DesignDocumentContent document={query.data} />;
}
