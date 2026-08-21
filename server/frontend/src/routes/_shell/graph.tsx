import { createFileRoute } from '@tanstack/react-router';
import { PlaceholderView } from '@/components/shell/placeholder-view';
import {
  PanelBody,
  PanelHeading,
  PanelHint,
} from '@/components/shell/right-panel';
import { useRightPanel } from '@/components/shell/use-shell';

export const Route = createFileRoute('/_shell/graph')({
  component: GraphView,
  staticData: { breadcrumb: 'Graph', viewId: 'graph' },
});

export function GraphPanel() {
  return (
    <>
      <PanelHeading>Canvas tools</PanelHeading>
      <PanelBody>
        <PanelHint>
          Layout controls, filters and the node inspector land here with the
          React Flow canvas.
        </PanelHint>
      </PanelBody>
    </>
  );
}

function GraphView() {
  useRightPanel(GraphPanel);

  return (
    <PlaceholderView
      title="Graph"
      description="Placeholder view. The React Flow canvas is a separate feature."
    />
  );
}
