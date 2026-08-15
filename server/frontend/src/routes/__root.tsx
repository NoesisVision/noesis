import type { QueryClient } from '@tanstack/react-query';
import { createRootRouteWithContext, Outlet } from '@tanstack/react-router';
import { TanStackRouterDevtools } from '@tanstack/react-router-devtools';
import { ThemeProvider } from '@/components/shell/theme-provider';
import { TooltipProvider } from '@/components/ui/tooltip';

// The query client reaches routes through the router's context, so `_shell`'s
// guard can read /ui/me in `beforeLoad` — before any component renders.
export interface RouterContext {
  queryClient: QueryClient;
}

export const Route = createRootRouteWithContext<RouterContext>()({
  component: RootComponent,
});

// The root route carries providers only. Everything visible lives under the
// `_shell` layout route, so a chrome-less route (the login page, and later a
// print view or embed) can sit next to it without unpicking the shell.
export function RootComponent() {
  return (
    <ThemeProvider>
      <TooltipProvider>
        <Outlet />
        {import.meta.env.DEV && (
          <TanStackRouterDevtools position="bottom-right" />
        )}
      </TooltipProvider>
    </ThemeProvider>
  );
}
