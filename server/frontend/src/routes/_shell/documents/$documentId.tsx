import { useQuery } from '@tanstack/react-query';
import { createFileRoute } from '@tanstack/react-router';
import { DesignDocumentView } from '@/components/design-doc/document-view';
import {
  PanelBody,
  PanelFields,
  PanelHeading,
} from '@/components/shell/right-panel';
import { useRightPanel } from '@/components/shell/use-shell';
import { Skeleton } from '@/components/ui/skeleton';
import { designDocDetailQueryOptions } from '@/lib/design-docs';

export const Route = createFileRoute('/_shell/documents/$documentId')({
  component: DocumentView,
  staticData: { breadcrumb: 'Document', viewId: 'document' },
});

export function DocumentPanel() {
  const { documentId } = Route.useParams();
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

export function DocumentView() {
  const { documentId } = Route.useParams();
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

  return <DesignDocumentView document={detail.data.document} />;
}
