import { IconFiles } from '@tabler/icons-react';
import { Stack } from '#/shared/design-system/stack.tsx';
import { Text } from '#/shared/design-system/text.tsx';
import { IconHeading } from '#/shared/ui/icon-heading.tsx';
import { Markdown } from '#/shared/ui/markdown.tsx';
import type { DocumentContents } from '../documents.api.ts';

/** The document is imported material: its markdown is shown as written. */
export function DocumentContent({
  document: doc,
}: {
  document: DocumentContents;
}) {
  return (
    <Stack component="article" maw={1000}>
      <IconHeading title={doc.title} icon={IconFiles} description={doc.date} />
      {doc.content.trim() ? (
        <Markdown>{doc.content}</Markdown>
      ) : (
        <Text c="dimmed">This document is empty.</Text>
      )}
    </Stack>
  );
}
