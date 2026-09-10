import { TanStackDevtools } from '@tanstack/react-devtools';
import { Outlet } from '@tanstack/react-router';
import { TanStackRouterDevtoolsPanel } from '@tanstack/react-router-devtools';
import TanStackQueryDevtools from '#/integrations/tanstack-query/devtools';

// Providers live in `main.tsx`; the root route is only the outlet and the
// devtools panel.
export function RootLayout() {
  return (
    <>
      <Outlet />
      <TanStackDevtools
        config={{ position: 'bottom-right' }}
        plugins={[
          { name: 'Tanstack Router', render: <TanStackRouterDevtoolsPanel /> },
          TanStackQueryDevtools,
        ]}
      />
    </>
  );
}
