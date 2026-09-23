import { useQueryErrorResetBoundary } from '@tanstack/react-query';
import { type ErrorComponentProps, useRouter } from '@tanstack/react-router';
import { useEffect } from 'react';
import { describeFailure } from '#/shared/api/failure.ts';
import { Button } from '#/shared/design-system/button.tsx';
import { uiLogger } from '#/shared/logging.ts';
import { StatusPanel } from './status-panel.tsx';

const log = uiLogger('error-panel');

/**
 * What every route boundary draws. A failed read, a failed loader and a render
 * that threw all arrive here, so the page says the same thing however it broke.
 */
export function ErrorPanel({ error }: ErrorComponentProps) {
  const router = useRouter();
  const queryErrors = useQueryErrorResetBoundary();
  const failure = describeFailure(error);

  useEffect(() => {
    // The boundary clears itself, but the query that failed keeps its error
    // until it is told as well, and `Try again` would land right back here.
    queryErrors.reset();
    log.error('route failed: {message}', { message: String(error), error });
  }, [error, queryErrors]);

  return (
    <StatusPanel
      announce
      code={failure.code}
      title={failure.title}
      description={failure.description}
      action={
        <Button variant="default" onClick={() => void router.invalidate()}>
          Try again
        </Button>
      }
    />
  );
}
