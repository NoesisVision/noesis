import { useQuery } from '@tanstack/react-query';
import { ApiError } from '#/api/client';
import { designDocById } from '#/api/design-docs';
import { Alert } from '#/components/design-system/alert';
import { Text } from '#/components/design-system/text';
import { DesignDocsLoadError } from './design-doc/design-docs-load-error.tsx';
import { DesignDocumentContent } from './design-doc/design-document-content.tsx';

export function DocumentDetail({
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
