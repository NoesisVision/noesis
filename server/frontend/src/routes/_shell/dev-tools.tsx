import { createFileRoute } from '@tanstack/react-router';
import { redirect } from '@tanstack/react-router';
import { DevToolsView } from '#/features/dev-tools/ui/dev-tools-view.tsx';
import { LOCAL_STORAGE_KEY } from '#/shared/dev-tools/dev-tools-context.tsx';
import { withViewHeader } from '#/shell/with-view-header.tsx';

export const Route = createFileRoute('/_shell/dev-tools')({
  component: withViewHeader(DevToolsView),
  beforeLoad: () => {
    if (localStorage.getItem(LOCAL_STORAGE_KEY) !== 'true') {
      throw redirect({
        to: '/',
      });
    }
  },
});
