import { createFileRoute } from '@tanstack/react-router';
import { PlaceholderView } from '@/components/shell/placeholder-view';
import {
  PanelBody,
  PanelHeading,
  PanelHint,
} from '@/components/shell/right-panel';
import { useRightPanel } from '@/components/shell/use-shell';

export const Route = createFileRoute('/_shell/documents')({
  component: DocumentsView,
  staticData: { breadcrumb: 'Documents', viewId: 'documents' },
});

export function DocumentsPanel() {
  return (
    <>
      <PanelHeading>Document info</PanelHeading>
      <PanelBody>
        <PanelHint>
          Outline, backlinks and collaboration presence land here with the
          BlockNote editor.
        </PanelHint>
      </PanelBody>
    </>
  );
}

export function DocumentsView() {
  useRightPanel(DocumentsPanel);

  return (
    <PlaceholderView
      title="Documents"
      description="Placeholder view. The editor is a separate feature."
    />
  );
}
