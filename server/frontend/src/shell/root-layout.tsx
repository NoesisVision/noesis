import { TanStackDevtools } from '@tanstack/react-devtools';
import { Outlet } from '@tanstack/react-router';
import { TanStackRouterDevtoolsPanel } from '@tanstack/react-router-devtools';
import TanStackQueryDevtools from '#/shared/query/devtools.tsx';

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
