import { useSuspenseQuery } from '@tanstack/react-query';
import { createFileRoute, redirect } from '@tanstack/react-router';
import { buttonVariants } from '@/components/ui/button';
import {
  authModeQueryOptions,
  LOGIN_HREF,
  localLoginHref,
  meQueryOptions,
  UnauthenticatedError,
} from '@/lib/auth';

export interface LoginSearch {
  /** The reason the callback bounced the user back here, if it did. */
  error?: string;
  /** The GitHub login the callback saw, so a refusal can name it. */
  login?: string;
}

export const Route = createFileRoute('/login')({
  // Two strings from our own callback; a hand-rolled check beats pulling a
  // validation library into the browser bundle for it.
  validateSearch: (search: Record<string, unknown>): LoginSearch => ({
    error: typeof search.error === 'string' ? search.error : undefined,
    login: typeof search.login === 'string' ? search.login : undefined,
  }),
  // Deliberately outside `_shell`: no sidebar, no top bar, nothing that would
  // assume a signed-in account (decision 45 left room for exactly this).
  beforeLoad: async ({ context }) => {
    try {
      await context.queryClient.ensureQueryData(meQueryOptions);
    } catch (error) {
      if (error instanceof UnauthenticatedError) {
        // Resolved here so the view below never suspends: the page IS the
        // sign-in control, and it must not paint the wrong one first.
        await context.queryClient.ensureQueryData(authModeQueryOptions);
        return;
      }
      throw error;
    }
    throw redirect({ to: '/' });
  },
  component: LoginView,
});

// lucide dropped brand marks, and the button is the whole page — it earns the
// twelve lines of path data.
export function GithubMark() {
  return (
    <svg viewBox="0 0 16 16" aria-hidden="true" fill="currentColor">
      <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27s1.36.09 2 .27c1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.01 8.01 0 0 0 16 8c0-4.42-3.58-8-8-8Z" />
    </svg>
  );
}

export function ProductMark() {
  return (
    <span className="flex size-10 items-center justify-center rounded-xl bg-primary text-lg font-medium text-primary-foreground">
      N
    </span>
  );
}

const MESSAGES: Record<string, string> = {
  invalid_state:
    'That sign-in link had expired or did not come from here. Start again.',
  missing_code: 'GitHub did not send an authorization code. Start again.',
  github_error: 'GitHub refused the sign-in. Start again.',
  expiring_tokens_disabled:
    'This deployment’s GitHub App must have expiring user tokens enabled. Ask whoever registered it.',
};

function LoginView() {
  const { error, login } = Route.useSearch();
  const { data: authMode } = useSuspenseQuery(authModeQueryOptions);
  const local = authMode.mode === 'local';
  // A refusal ends the road on a real deployment: the user is already
  // authenticated with GitHub, so the same button would bounce straight back
  // here. Locally it does not — switching identity is the way out.
  const refused = error === 'not_invited';
  const offerSignIn = local || !refused;

  return (
    <main className="flex min-h-svh items-center justify-center bg-background p-6">
      <div className="flex w-full max-w-sm flex-col gap-6 rounded-xl border bg-card p-6 text-card-foreground shadow-xs">
        <div className="flex flex-col items-center gap-3 text-center">
          <ProductMark />
          <div className="flex flex-col gap-1">
            <h1 className="text-lg font-medium">Noesis</h1>
            <p className="text-sm text-muted-foreground">
              {local
                ? 'Local development: pick an identity. The first one to sign in claims this instance as its owner; the rest need an invite.'
                : 'Sign in with the GitHub account that owns the repositories you want to work on.'}
            </p>
          </div>
        </div>

        {refused && (
          <p className="rounded-lg border border-destructive/40 bg-destructive/5 p-3 text-sm">
            This Noesis instance is invite-only.{' '}
            {local
              ? 'Sign in as the owner and invite'
              : 'Ask an owner to invite'}{' '}
            <span className="font-medium">@{login ?? 'your account'}</span>
            {local ? ' from Settings → Members.' : '.'}
          </p>
        )}
        {offerSignIn && (
          <>
            {!refused && error !== undefined && (
              <p className="rounded-lg border border-destructive/40 bg-destructive/5 p-3 text-sm">
                {MESSAGES[error] ?? 'Sign-in failed. Start again.'}
              </p>
            )}
            {/* Anchors, not fetches: the whole flow is a navigation. */}
            {local ? (
              <div className="flex flex-col gap-2">
                {authMode.accounts.map((account, index) => (
                  <a
                    key={account.login}
                    href={localLoginHref(account.login)}
                    className={buttonVariants({
                      className: 'w-full',
                      variant: index === 0 ? 'default' : 'outline',
                    })}
                  >
                    <span>
                      {account.name} (@{account.login})
                    </span>
                  </a>
                ))}
              </div>
            ) : (
              <a
                href={LOGIN_HREF}
                className={buttonVariants({ className: 'w-full' })}
              >
                <GithubMark />
                <span>
                  {error === undefined
                    ? 'Continue with GitHub'
                    : 'Try again with GitHub'}
                </span>
              </a>
            )}
          </>
        )}
      </div>
    </main>
  );
}
