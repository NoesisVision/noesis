import { Link, useParams } from '@tanstack/react-router';
import { Button } from '#/shared/design-system/button';
import { StatusPanel } from '#/shared/ui/status-panel.tsx';

export function ChangeNotFoundView() {
  const { changeId } = useParams({ strict: false });
  return (
    <StatusPanel
      code="404"
      title="Change not found"
      description={`There is no change "${changeId}" in this repository. Pick one from the sidebar, or go back to the last one you opened.`}
      action={
        <Button
          variant="default"
          renderRoot={(props) => <Link {...props} to="/" />}
        >
          Back
        </Button>
      }
    />
  );
}
