import { useQueryClient } from '@tanstack/react-query';
import { useNavigate } from '@tanstack/react-router';
import { LogOutIcon, MoonIcon, SunIcon } from 'lucide-react';
import { CreateProjectForm } from '@/components/shell/create-project-form';
import { writeShellState } from '@/components/shell/shell-store';
import { useTheme } from '@/components/shell/use-theme';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button, buttonVariants } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  type Account,
  INSTALL_HREF,
  type Installation,
  signOut,
} from '@/lib/auth';

function initialsOf(name: string, login: string): string {
  const source = name.trim() === '' ? login : name;
  return source
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part.slice(0, 1).toUpperCase())
    .join('');
}

function WelcomeTopBar({ account }: { account: Account }) {
  const { theme, toggleTheme } = useTheme();
  const queryClient = useQueryClient();

  async function logOut() {
    await signOut();
    // Same as AccountMenu: the session is gone, so nothing cached may
    // survive into the next sign-in.
    queryClient.clear();
    window.location.assign('/login');
  }

  return (
    <header className="flex h-12 flex-none items-center gap-2 border-b px-4">
      <span className="font-semibold">Noesis</span>
      <div className="flex-1" />
      <Button
        variant="ghost"
        size="icon-sm"
        onClick={toggleTheme}
        aria-label="Toggle theme"
      >
        {theme === 'dark' ? <MoonIcon /> : <SunIcon />}
      </Button>
      <DropdownMenu>
        <DropdownMenuTrigger
          render={
            <button
              type="button"
              className="rounded-full"
              aria-label="Account menu"
            >
              <Avatar className="size-7">
                <AvatarImage src={account.avatarUrl} alt="" />
                <AvatarFallback>
                  {initialsOf(account.name, account.login)}
                </AvatarFallback>
              </Avatar>
            </button>
          }
        />
        <DropdownMenuContent align="end" side="bottom" className="min-w-48">
          <DropdownMenuGroup>
            {/* Base UI requires the label to sit inside its group. */}
            <DropdownMenuLabel>@{account.login}</DropdownMenuLabel>
            <DropdownMenuItem onClick={logOut}>
              <LogOutIcon className="size-4" />
              <span>Sign out</span>
            </DropdownMenuItem>
          </DropdownMenuGroup>
        </DropdownMenuContent>
      </DropdownMenu>
    </header>
  );
}

/**
 * The first-run page (projects.md §5, welcome prototype): shown instead of
 * the shell while no project exists. No sidebar — the nav appears with the
 * first project. One job: a greeting and the create form, inline; with no
 * installation yet, the install hand-off instead.
 */
export function WelcomeView({
  account,
  installations,
}: {
  account: Account;
  installations: Installation[];
}) {
  const navigate = useNavigate();

  return (
    <div className="flex h-svh flex-col bg-background text-foreground">
      <WelcomeTopBar account={account} />
      <main className="grid flex-1 place-items-center overflow-auto px-4 py-8">
        <div className="flex w-full max-w-md flex-col gap-6">
          <div className="flex flex-col gap-2">
            <span
              aria-hidden="true"
              className="grid size-11 place-items-center rounded-xl bg-primary text-xl font-bold text-primary-foreground"
            >
              N
            </span>
            <h1 className="text-balance text-2xl font-semibold tracking-tight">
              Welcome to Noesis, @{account.login}
            </h1>
            <p className="text-muted-foreground">
              Noesis builds a living model of your codebase. Everything lives in
              a <strong>project</strong> — a named home for the repositories of
              one codebase. Create yours to get started.
            </p>
          </div>

          {installations.length === 0 ? (
            <section className="flex flex-col gap-3 rounded-lg border bg-card p-4 text-card-foreground shadow-xs">
              <h2 className="text-sm font-semibold">Connect GitHub first</h2>
              <p className="text-xs text-muted-foreground">
                The GitHub App has no repository access yet. Install it on your
                account or organisation — you'll be brought straight back here.
              </p>
              <div>
                <a
                  href={`${INSTALL_HREF}?returnTo=/`}
                  className={buttonVariants()}
                >
                  Install the GitHub App
                </a>
              </div>
            </section>
          ) : (
            <section className="flex flex-col gap-3 rounded-lg border bg-card p-4 text-card-foreground shadow-xs">
              <CreateProjectForm
                title="Create your first project"
                installations={installations}
                onCreated={async (project) => {
                  // No shell context exists yet; the provider reads this when
                  // it mounts with the first project.
                  writeShellState('projectId', project.id);
                  await navigate({ to: '/project' });
                }}
              />
            </section>
          )}
        </div>
      </main>
    </div>
  );
}
