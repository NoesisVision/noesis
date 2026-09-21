import { QueryClientProvider } from '@tanstack/react-query';
import { RouterProvider } from '@tanstack/react-router';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { MantineProvider } from '#/components/design-system/provider';
import { colorSchemeManager, theme } from '#/components/design-system/theme';
import { getRouter } from '#/router';
import { configureLogging } from '#/shared/logging.ts';
import { getContext } from '#/shared/query/query-client.tsx';
import '#/components/design-system/styles';
import '@fontsource-variable/raleway';
import '#/styles.css';

// The backend imports `index.html`, which is how bun finds and bundles this
// entry (decision D5).
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
