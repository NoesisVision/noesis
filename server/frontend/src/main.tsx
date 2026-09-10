import { QueryClientProvider } from '@tanstack/react-query';
import { RouterProvider } from '@tanstack/react-router';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { getContext } from '#/integrations/tanstack-query/root-provider';
import { getRouter } from '#/router';
import '#/styles.css';

// The single browser entry point: this app is a plain SPA, so nothing here
// runs anywhere but the browser (decision 67).
const context = getContext();
const router = getRouter(context);

const rootElement = document.getElementById('app');
if (!rootElement) {
  throw new Error('index.html is missing the #app mount point');
}

createRoot(rootElement).render(
  <StrictMode>
    <QueryClientProvider client={context.queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>
  </StrictMode>,
);
