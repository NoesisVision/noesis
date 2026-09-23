import { IconFiles } from '@tabler/icons-react';
import { Card } from '#/shared/design-system/card.tsx';
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
    <Stack component="article">
      <IconHeading title={doc.title} icon={IconFiles} description={doc.date} />
      <Card withBorder>
        {doc.content.trim() ? (
          <Markdown>{doc.content}</Markdown>
        ) : (
          <Text c="dimmed">This document is empty.</Text>
        )}
      </Card>
    </Stack>
  );
}
