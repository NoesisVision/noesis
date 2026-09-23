import { Link } from '@tanstack/react-router';
import { Button } from '#/shared/design-system/button.tsx';
import { StatusPanel } from './status-panel.tsx';

/** What the router itself declares missing: an unknown address, or a route that said so. */
export function NotFoundPanel() {
  return (
    <StatusPanel
      code="404"
      title="Not found"
      description="There is nothing at this address. Pick a change from the sidebar, or start again from the top."
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
