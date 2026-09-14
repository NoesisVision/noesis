import { QueryClientProvider } from '@tanstack/react-query';
import { RouterProvider } from '@tanstack/react-router';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { MantineProvider } from '#/components/design-system/provider';
import { colorSchemeManager, theme } from '#/components/design-system/theme';
import { getContext } from '#/integrations/tanstack-query/root-provider';
import { configureLogging } from '#/logging';
import { getRouter } from '#/router';
import '#/components/design-system/styles';
import '@fontsource-variable/raleway';
import '#/styles.css';

// The single browser entry point: this app is a plain SPA, so nothing here
// runs anywhere but the browser (decision 67). The backend imports
// `index.html`, which is how bun finds this file and bundles it.
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
      defaultColorScheme="auto"
      colorSchemeManager={colorSchemeManager}
    >
      <QueryClientProvider client={context.queryClient}>
        <RouterProvider router={router} />
      </QueryClientProvider>
    </MantineProvider>
  </StrictMode>,
);
