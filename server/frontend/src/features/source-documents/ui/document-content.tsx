import { Card } from '#/shared/design-system/card.tsx';
import { Text } from '#/shared/design-system/text.tsx';
import { FormattedDate } from '#/shared/ui/formatted-date.tsx';
import { MarkdownEditor } from '#/shared/ui/markdown-editor.tsx';
import { ReadingPane } from '#/shared/ui/reading-pane.tsx';
import type { SourceDocument } from '#backend/app/changes/model/source-document.ts';
import { DocumentsIcon } from '../source-documents.model.ts';

/** The document is imported material: its markdown is shown as written. */
export function DocumentContent({
  document: doc,
}: {
  document: SourceDocument;
}) {
  return (
    <ReadingPane
      title={doc.title}
      icon={DocumentsIcon}
      description={<FormattedDate value={doc.date} />}
    >
      <Card withBorder>
        {doc.content.trim() ? (
          // The editor reads its markdown once, so a different document is a
          // different editor rather than the same one told to change.
          <MarkdownEditor key={doc.id} markdown={doc.content} readOnly />
        ) : (
          <Text c="dimmed">This document is empty.</Text>
        )}
      </Card>
    </ReadingPane>
  );
}
