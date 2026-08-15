import { useQuery } from '@tanstack/react-query';
import {
  CheckIcon,
  ExternalLinkIcon,
  LockIcon,
  PuzzleIcon,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { INSTALL_HREF, type Installation } from '@/lib/auth';
import { pickerQueryOptions } from '@/lib/projects';
import { cn } from '@/lib/utils';

/**
 * The repository picker (projects.md §2): exactly what the App can reach
 * through one installation. Repositories owned by another project render
 * disabled with the owner's name — the refusal is shown before it happens.
 */
export function RepoPicker({
  installationId,
  selected,
  onToggle,
  excludeIds = [],
}: {
  installationId: string;
  selected: ReadonlySet<string>;
  onToggle: (id: string) => void;
  /** Already-connected ids the caller wants hidden (the attach flow). */
  excludeIds?: readonly string[];
}) {
  const repos = useQuery(pickerQueryOptions(installationId));

  if (repos.isPending) return <Skeleton className="h-24 w-full rounded-lg" />;
  if (repos.error) {
    return <p className="text-sm text-destructive">{repos.error.message}</p>;
  }

  const visible = repos.data.filter((repo) => !excludeIds.includes(repo.id));
  if (visible.length === 0) {
    return (
      <p className="rounded-lg border bg-card p-3 text-sm text-muted-foreground shadow-xs">
        No repositories to pick from. Grant the App access on GitHub below — you
        will come back here.
      </p>
    );
  }

  return (
    <ul className="flex max-h-64 flex-col gap-1 overflow-y-auto">
      {visible.map((repo) => {
        const owned = repo.owningProject !== null;
        const picked = selected.has(repo.id);
        return (
          <li key={repo.id}>
            <button
              type="button"
              disabled={owned}
              onClick={() => onToggle(repo.id)}
              className={cn(
                'flex w-full items-center gap-2 rounded-lg border px-3 py-2 text-left text-sm',
                picked ? 'border-primary bg-accent' : 'bg-card',
                owned && 'opacity-60',
              )}
            >
              <span className="flex min-w-0 flex-1 items-center gap-2">
                <span className="truncate font-medium">{repo.fullName}</span>
                {repo.private && (
                  <LockIcon className="size-3 shrink-0 text-muted-foreground" />
                )}
              </span>
              {owned ? (
                <span className="shrink-0 text-xs text-muted-foreground">
                  in {repo.owningProject?.name}
                </span>
              ) : (
                picked && <CheckIcon className="size-4 shrink-0" />
              )}
            </button>
          </li>
        );
      })}
    </ul>
  );
}

/**
 * The two grant affordances: extend an existing installation on GitHub's own
 * settings screen, or install the App on another account. `returnTo` brings
 * the user back to where they left the connect flow (projects.md §2).
 */
export function GrantAccessLinks({
  installation,
  returnTo,
}: {
  installation: Installation | undefined;
  returnTo: string;
}) {
  const installHref = `${INSTALL_HREF}?returnTo=${encodeURIComponent(returnTo)}`;
  return (
    <div className="flex flex-wrap gap-2">
      {installation !== undefined && (
        <Button
          variant="outline"
          size="sm"
          render={
            <a href={installation.manageUrl} target="_blank" rel="noreferrer">
              <ExternalLinkIcon />
              <span>Manage repository access on GitHub</span>
            </a>
          }
        />
      )}
      <Button
        variant="outline"
        size="sm"
        render={
          <a href={installHref}>
            <PuzzleIcon />
            <span>Install on another account</span>
          </a>
        }
      />
    </div>
  );
}
