import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { createFileRoute, Link } from '@tanstack/react-router';
import { FilePlus2Icon, Trash2Icon } from 'lucide-react';
import { client } from '@/client';
import { PlaceholderView } from '@/components/shell/placeholder-view';
import {
  PanelBody,
  PanelHeading,
  PanelHint,
} from '@/components/shell/right-panel';
import { useRightPanel, useShell } from '@/components/shell/use-shell';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { DESIGN_DOCS_KEY, designDocsQueryOptions } from '@/lib/design-docs';

export const Route = createFileRoute('/_shell/documents/')({
  component: DocumentsView,
  staticData: { breadcrumb: 'Documents', viewId: 'documents' },
});

export function DocumentsPanel() {
  return (
    <>
      <PanelHeading>Documents</PanelHeading>
      <PanelBody>
        <PanelHint>
          Design documents of the current project. Open one to read it; editing
          and collaboration arrive with the editor.
        </PanelHint>
      </PanelBody>
    </>
  );
}

export function DocumentsList({ projectId }: { projectId: string }) {
  const queryClient = useQueryClient();
  const list = useQuery(designDocsQueryOptions(projectId));

  const invalidate = async () => {
    await queryClient.invalidateQueries({ queryKey: DESIGN_DOCS_KEY });
  };

  const createSample = useMutation({
    mutationFn: async () => {
      const response = await client.ui['design-docs'].sample.$post({
        json: { projectId },
      });
      if (!response.ok) {
        throw new Error(`Could not create the sample (${response.status}).`);
      }
    },
    onSuccess: invalidate,
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const response = await client.ui['design-docs'][':id'].$delete({
        param: { id },
      });
      if (!response.ok) {
        throw new Error(`Could not delete the document (${response.status}).`);
      }
    },
    onSuccess: invalidate,
  });

  if (list.isPending) return <Skeleton className="h-24 w-full rounded-lg" />;
  if (list.error) {
    return <p className="text-sm text-destructive">{list.error.message}</p>;
  }

  return (
    <section className="flex max-w-2xl flex-col gap-3">
      <div className="flex items-center gap-2">
        <h2 className="text-sm font-medium">Design documents</h2>
        <Button
          variant="outline"
          size="sm"
          className="ml-auto"
          disabled={createSample.isPending}
          onClick={() => createSample.mutate()}
        >
          <FilePlus2Icon />
          <span>Create sample document</span>
        </Button>
      </div>

      {list.data.length === 0 ? (
        <p className="rounded-lg border bg-card p-3 text-sm text-muted-foreground shadow-xs">
          No design documents yet. The agent will write them; until then the
          sample document shows what one reads like.
        </p>
      ) : (
        <ul className="flex flex-col gap-1">
          {list.data.map((doc) => (
            <Link
              to="/documents/$documentId"
              params={{ documentId: doc.id }}
              key={doc.id}
            >
              <li
                key={doc.id}
                className="flex flex-1 min-w-0 items-center gap-3 rounded-lg border bg-card px-3 py-2 text-card-foreground shadow-xs hover:bg-accent"
              >
                <div className="flex flex-1 items-center gap-3">
                  <span className="truncate text-sm font-medium">
                    {doc.name}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {doc.date}
                  </span>
                </div>
                <div className="flex flex-1 items-center text-right gap-3 justify-end">
                  <Badge variant="outline">{doc.status}</Badge>
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    aria-label={`Delete ${doc.name}`}
                    disabled={remove.isPending}
                    onClick={(e) => {
                      e.stopPropagation();
                      e.preventDefault();
                      remove.mutate(doc.id);
                    }}
                  >
                    <Trash2Icon />
                  </Button>
                </div>
              </li>
            </Link>
          ))}
        </ul>
      )}

      {createSample.error && (
        <p className="text-sm text-destructive">{createSample.error.message}</p>
      )}
      {remove.error && (
        <p className="text-sm text-destructive">{remove.error.message}</p>
      )}
    </section>
  );
}

function DocumentsView() {
  const { project } = useShell();
  useRightPanel(DocumentsPanel);

  // Unreachable in practice: with zero projects the layout renders the
  // welcome page instead of the shell.
  if (project === null) return null;

  return (
    <PlaceholderView
      title="Documents"
      description="The design documents of this project, read as one specification."
    >
      <DocumentsList projectId={project.id} />
    </PlaceholderView>
  );
}
