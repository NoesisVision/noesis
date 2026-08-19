import { useQuery } from '@tanstack/react-query';
import { createFileRoute } from '@tanstack/react-router';
import * as React from 'react';
import { useShell } from '@/components/shell/use-shell';
import { Skeleton } from '@/components/ui/skeleton';
import { designDocDetailQueryOptions } from '@/lib/design-docs';

// The editor pulls BlockNote and Yjs in; keep them in their own chunk.
const DesignDocEditorView = React.lazy(() =>
  import('@/components/design-doc/design-doc-editor').then((module) => ({
    default: module.DesignDocEditorView,
  })),
);

export const Route = createFileRoute('/_shell/documents/$documentId')({
  component: DocumentView,
  staticData: { breadcrumb: 'Document', viewId: 'document' },
});

/**
 * One document, one surface (prototype): always the collaborative editor,
 * with the table of contents rail beside it and the comments rail on the
 * right. No shell right panel here — the comments rail is the document's
 * only side column; the summary fields it used to show live on the
 * documents list.
 */
export function DocumentView() {
  const { documentId } = Route.useParams();
  const { account } = useShell();
  const detail = useQuery(designDocDetailQueryOptions(documentId));

  if (detail.isPending) {
    return (
      <div className="p-6">
        <Skeleton className="h-40 w-full max-w-2xl rounded-lg" />
      </div>
    );
  }
  if (detail.error) {
    return (
      <p className="p-6 text-sm text-destructive">{detail.error.message}</p>
    );
  }

  return (
    <React.Suspense
      fallback={
        <div className="p-6">
          <Skeleton className="h-40 w-full max-w-2xl rounded-lg" />
        </div>
      }
    >
      <DesignDocEditorView
        documentId={documentId}
        account={account}
        title={detail.data.summary.name}
        subtitle={`${detail.data.summary.status} · ${detail.data.summary.date}`}
      />
    </React.Suspense>
  );
}
