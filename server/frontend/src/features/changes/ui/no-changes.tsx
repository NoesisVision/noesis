import { StatusPanel } from '#/shared/ui/status-panel.tsx';

export function NoChangesView() {
  return (
    <StatusPanel
      title="No changes yet"
      description="A change is the unit of work Noesis tracks: imported documents and design documents all hang under one. Ask the agent to create the first one; this page only reads."
    />
  );
}
