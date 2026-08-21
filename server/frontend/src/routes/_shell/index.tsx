import { createFileRoute } from '@tanstack/react-router';
import { PlaceholderView } from '@/components/shell/placeholder-view';
import {
  PanelBody,
  PanelFields,
  PanelHeading,
  PanelHint,
  SelectionInspector,
} from '@/components/shell/right-panel';
import {
  type ShellSelection,
  useRightPanel,
  useShell,
} from '@/components/shell/use-shell';
import { cn } from '@/lib/utils';

export const Route = createFileRoute('/_shell/')({
  component: DashboardView,
  staticData: { breadcrumb: 'Dashboard', viewId: 'dashboard' },
});

// Stand-ins for the real activity feed; they exist to prove the selection →
// inspector flow end to end.
const ACTIVITY: ShellSelection[] = [
  {
    type: 'scan',
    id: 'scan_01J8ZQ',
    title: 'Java scan finished',
    fields: { Status: 'succeeded', Duration: '48s', Findings: '12' },
    detail: 'Scanned 214 files across 9 modules.',
  },
  {
    type: 'document',
    id: 'doc_01J8ZR',
    title: 'Ingestion design notes',
    fields: { Status: 'draft', Updated: '2 hours ago' },
    detail: 'Started from the decision log; not yet linked to the graph.',
  },
  {
    type: 'graph-node',
    id: 'node_01J8ZS',
    title: 'OrderService',
    fields: { Status: 'indexed', Edges: '17' },
    detail: 'Central node of the ordering cluster.',
  },
];

// The chart tokens are the theme's only palette beyond the terracotta primary;
// using them to mark entity kinds keeps the list from reading as one colour.
const TYPE_DOT: Record<string, string> = {
  scan: 'bg-primary',
  document: 'bg-chart-2',
  'graph-node': 'bg-chart-1',
};

// Module-level so the registration effect runs once, not on every render.
export function DashboardPanel() {
  return (
    <>
      <PanelHeading>Overview</PanelHeading>
      <PanelBody>
        <PanelFields
          fields={{
            Views: '4',
            Selection: 'none',
            Panel: 'route default',
          }}
        />
        <PanelHint>
          This panel is contextual: each route registers its own content, and
          selecting an item in the main section swaps it for an inspector. Pick
          something under Recent activity.
        </PanelHint>
      </PanelBody>
    </>
  );
}

// Registering from a child component keeps the hook unconditional while the
// registration itself is conditional: mounted only while something is
// selected, and the route's own panel comes back on unmount.
export function SelectionPanelBinding() {
  useRightPanel(SelectionInspector);
  return null;
}

function DashboardView() {
  const { selection, setSelection } = useShell();
  useRightPanel(DashboardPanel);

  return (
    <PlaceholderView
      title="Dashboard"
      description="Placeholder view. Real widgets land with the dashboard feature."
    >
      {selection && <SelectionPanelBinding />}
      <section className="flex max-w-2xl flex-col gap-2">
        <h2 className="text-sm font-medium text-muted-foreground">
          Recent activity
        </h2>
        <ul className="flex flex-col gap-1">
          {ACTIVITY.map((item) => {
            const isSelected = selection?.id === item.id;
            return (
              <li key={item.id}>
                <button
                  type="button"
                  aria-pressed={isSelected}
                  onClick={() => setSelection(isSelected ? null : item)}
                  className={cn(
                    'flex w-full items-center gap-3 rounded-lg border bg-card px-3 py-2 text-left text-card-foreground shadow-xs transition-colors hover:bg-accent hover:text-accent-foreground',
                    isSelected &&
                      'border-primary/60 bg-secondary text-secondary-foreground',
                  )}
                >
                  <span
                    aria-hidden="true"
                    className={cn(
                      'size-2 shrink-0 rounded-full',
                      TYPE_DOT[item.type] ?? 'bg-muted-foreground',
                    )}
                  />
                  <span className="flex flex-col gap-0.5">
                    <span className="text-sm font-medium">{item.title}</span>
                    <span className="text-xs text-muted-foreground">
                      {item.type} · {item.id}
                    </span>
                  </span>
                  {item.fields?.Status && (
                    <span className="ml-auto rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">
                      {item.fields.Status}
                    </span>
                  )}
                </button>
              </li>
            );
          })}
        </ul>
      </section>
    </PlaceholderView>
  );
}
