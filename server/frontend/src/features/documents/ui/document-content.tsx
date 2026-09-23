import { IconFiles } from '@tabler/icons-react';
import { Card } from '#/shared/design-system/card.tsx';
import { Stack } from '#/shared/design-system/stack.tsx';
import { Text } from '#/shared/design-system/text.tsx';
import { IconHeading } from '#/shared/ui/icon-heading.tsx';
import { MarkdownEditor } from '#/shared/ui/markdown-editor.tsx';
import type { DocumentContents } from '../documents.api.ts';

/** The document is imported material: its markdown is shown as written. */
export function DocumentContent({
  document: doc,
}: {
  document: DocumentContents;
}) {
  return (
    <Stack component="article">
      <IconHeading title={doc.title} icon={IconFiles} description={doc.date} />
      <Card withBorder radius="md">
        {doc.content.trim() ? (
          // The editor reads its markdown once, so a different document is a
          // different editor rather than the same one told to change.
          <MarkdownEditor
            key={doc.document_id}
            markdown={doc.content}
            readOnly
          />
        ) : (
          <Text c="dimmed">This document is empty.</Text>
        )}
      </Card>
    </Stack>
  );
}
