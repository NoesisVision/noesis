import { useQuery } from '@tanstack/react-query';
import { ApiError } from '#/shared/api/client.ts';
import { Alert } from '#/shared/design-system/alert';
import { Text } from '#/shared/design-system/text';
import { documentById } from '../documents.api.ts';
import { DocumentContent } from './document-content.tsx';
import { DocumentsLoadError } from './documents-load-error.tsx';

export function DocumentDetail({
  changeId,
  id,
}: {
  changeId: string;
  id: string;
}) {
  const query = useQuery(documentById(changeId, id));
  if (query.isPending) return <Text component="output">Loading document…</Text>;
  if (query.isError) {
    if (query.error instanceof ApiError && query.error.status === 404) {
      return (
        <Alert title="Document not found">
          This document is no longer available in this change.
        </Alert>
      );
    }
    return <DocumentsLoadError retry={() => void query.refetch()} />;
  }
  return <DocumentContent document={query.data} />;
}
