import { useQuery } from '@tanstack/react-query';
import { createFileRoute, useParams } from '@tanstack/react-router';
import * as React from 'react';
import {
  PanelBody,
  PanelFields,
  PanelHeading,
} from '@/components/shell/right-panel';
import { useRightPanel, useShell } from '@/components/shell/use-shell';
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

export function DocumentPanel() {
  // The shell keeps this panel registered until the view's cleanup effect
  // runs — one render after navigating away, when this route has no active
  // match and strict `useParams` would throw. Read loosely and go blank for
  // that render instead.
  const params = useParams({
    from: '/_shell/documents/$documentId',
    shouldThrow: false,
  });
  if (params === undefined) return null;
  return <DocumentPanelContent documentId={params.documentId} />;
}

function DocumentPanelContent({ documentId }: { documentId: string }) {
  const detail = useQuery(designDocDetailQueryOptions(documentId));
  if (detail.data === undefined) return null;
  const { summary, document } = detail.data;
  return (
    <>
      <PanelHeading>Document</PanelHeading>
      <PanelBody>
        <PanelFields
          fields={{
            Name: summary.name,
            Status: summary.status,
            Date: summary.date,
            Actors: String(document.actors.length),
            'Use cases': String(document.useCases.length),
          }}
        />
      </PanelBody>
    </>
  );
}

/**
 * One document, one surface (prototype): always the collaborative editor,
 * with the table of contents rail beside it. The detail query serves the
 * title line and the right panel; the content itself syncs over /collab.
 */
export function DocumentView() {
  const { documentId } = Route.useParams();
  const { account } = useShell();
  const detail = useQuery(designDocDetailQueryOptions(documentId));
  useRightPanel(DocumentPanel);

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
        userName={account.name || account.login}
        title={detail.data.summary.name}
        subtitle={`${detail.data.summary.status} · ${detail.data.summary.date}`}
      />
    </React.Suspense>
  );
}
