import { useQuery } from '@tanstack/react-query';
import { Text } from '#/shared/design-system/text';
import { documentById } from '../documents.api.ts';
import { DocumentContent } from './document-content.tsx';

export function DocumentDetail({
  changeId,
  id,
}: {
  changeId: string;
  id: string;
}) {
  const query = useQuery(documentById(changeId, id));
  // `isSuccess` is what narrows the data; the error state throws instead of
  // rendering, so nothing else is left to be in.
  if (!query.isSuccess)
    return <Text component="output">Loading document…</Text>;
  return <DocumentContent document={query.data} />;
}
