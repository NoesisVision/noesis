import { createRootRoute, Outlet } from '@tanstack/react-router';
import { TanStackRouterDevtools } from '@tanstack/react-router-devtools';
import { ThemeProvider } from '@/components/shell/theme-provider';
import { TooltipProvider } from '@/components/ui/tooltip';

export const Route = createRootRoute({
  component: RootComponent,
});

// The root route carries providers only. Everything visible lives under the
// `_shell` layout route, so a future chrome-less route (print view, embed) can
// sit next to it without unpicking the shell.
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
