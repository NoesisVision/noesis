import { StatusPanel } from '#/shared/ui/status-panel.tsx';

/** The project's wiki: named in the rail already, written later. */
export function WikiView() {
  return (
    <StatusPanel
      headingLevel={2}
      title="The wiki is not here yet"
      description="It will gather what is known about this project in one place."
    />
  );
}
