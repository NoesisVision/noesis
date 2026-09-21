import { useQuery } from '@tanstack/react-query';
import { ApiError } from '#/shared/api/client.ts';
import { Alert } from '#/shared/design-system/alert';
import { Text } from '#/shared/design-system/text';
import { designDocById } from '../design-docs.api.ts';
import { DesignDocsLoadError } from './design-docs-load-error.tsx';
import { DesignDocumentContent } from './design-document-content.tsx';

export function DesignDocDetail({
  changeId,
  id,
}: {
  changeId: string;
  id: string;
}) {
  const query = useQuery(designDocById(changeId, id));
  if (query.isPending)
    return <Text component="output">Loading design document…</Text>;
  if (query.isError) {
    if (query.error instanceof ApiError && query.error.status === 404) {
      return (
        <Alert title="Document not found">
          This document is no longer available in this change.
        </Alert>
      );
    }
    return <DesignDocsLoadError retry={() => void query.refetch()} />;
  }
  return <DesignDocumentContent document={query.data} />;
}
