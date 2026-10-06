import { QueryClientProvider } from '@tanstack/react-query';
import { RouterProvider } from '@tanstack/react-router';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { getRouter } from '#/router';
import { MantineProvider } from '#/shared/design-system/provider';
import {
  colorSchemeManager,
  cssVariablesResolver,
  theme,
} from '#/shared/design-system/theme';
import { DevToolsContextProvider } from '#/shared/dev-tools/dev-tools-context.tsx';
import { configureLogging } from '#/shared/logging.ts';
import { getContext } from '#/shared/query/query-client.tsx';
import { DateFormatProvider } from '#/shared/ui/date-format-provider.tsx';
import { FullscreenPortals } from '#/shared/ui/fullscreen-portals.tsx';
import '#/shared/design-system/styles';
import '@fontsource-variable/raleway';
import '#/styles.css';

// The backend imports `index.html`, which is how bun finds and bundles this
// entry.
configureLogging();
const context = getContext();
const router = getRouter(context);

const rootElement = document.getElementById('app');
if (!rootElement) {
  throw new Error('index.html is missing the #app mount point');
}

createRoot(rootElement).render(
  <StrictMode>
    <MantineProvider
      theme={theme}
      cssVariablesResolver={cssVariablesResolver}
      defaultColorScheme="auto"
      colorSchemeManager={colorSchemeManager}
    >
      <FullscreenPortals>
        <QueryClientProvider client={context.queryClient}>
          <DevToolsContextProvider>
            <DateFormatProvider>
              <RouterProvider router={router} />
            </DateFormatProvider>
          </DevToolsContextProvider>
        </QueryClientProvider>
      </FullscreenPortals>
    </MantineProvider>
  </StrictMode>,
);
