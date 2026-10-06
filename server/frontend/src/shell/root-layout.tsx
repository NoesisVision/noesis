import { Outlet } from '@tanstack/react-router';
import { lazy, Suspense } from 'react';

/*
 * Only while developing: a production build drops the branch, and with it the
 * import, so the devtools and their launcher never reach a reader's page.
 */
const Devtools = import.meta.env.DEV
  ? lazy(() => import('./devtools.tsx'))
  : null;

export function RootLayout() {
  return (
    <>
      <Outlet />
      {Devtools && (
        <Suspense fallback={null}>
          <Devtools />
        </Suspense>
      )}
    </>
  );
}
