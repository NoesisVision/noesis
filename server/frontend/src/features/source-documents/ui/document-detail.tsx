import { useQuery } from '@tanstack/react-query';
import { LoadingPanel } from '#/shared/ui/loading-panel.tsx';
import { sourceDocumentById } from '../source-documents.api.ts';
import { DocumentContent } from './document-content.tsx';

export function DocumentDetail({
  changeId,
  id,
}: {
  changeId: string;
  id: string;
}) {
  const query = useQuery(sourceDocumentById(changeId, id));
  // `isSuccess` is what narrows the data; the error state throws instead of
  // rendering, so nothing else is left to be in.
  if (!query.isSuccess) return <LoadingPanel label="Loading document…" />;
  return <DocumentContent document={query.data} />;
}
