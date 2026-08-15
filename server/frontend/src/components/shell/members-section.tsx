import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Trash2Icon, UserPlusIcon } from 'lucide-react';
import * as React from 'react';
import { client } from '@/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';

const INVITES_KEY = ['ui', 'invites'] as const;

async function listInvites() {
  const response = await client.ui.invites.$get();
  if (!response.ok) {
    throw new Error(`Could not load invites (${response.status}).`);
  }
  return (await response.json()).invites;
}

/**
 * The owner-only membership surface over `/ui/invites`: who is waiting to be
 * let in, and the one way to let them. Invites are by GitHub login because
 * that is the only thing the sign-in callback can verify.
 *
 * Rendered only for owners; the endpoints behind it answer 403 to everyone
 * else, so hiding it is a courtesy, not the control.
 */
export function MembersSection() {
  const queryClient = useQueryClient();
  const [login, setLogin] = React.useState('');
  const invites = useQuery({ queryKey: INVITES_KEY, queryFn: listInvites });

  const invalidate = () =>
    queryClient.invalidateQueries({ queryKey: INVITES_KEY });

  const invite = useMutation({
    mutationFn: async (ghLogin: string) => {
      const response = await client.ui.invites.$post({ json: { ghLogin } });
      if (!response.ok) {
        const body = (await response.json()) as { error?: string };
        throw new Error(body.error ?? `Invite failed (${response.status}).`);
      }
    },
    onSuccess: async () => {
      setLogin('');
      await invalidate();
    },
  });

  const revoke = useMutation({
    mutationFn: async (id: string) => {
      const response = await client.ui.invites[':id'].$delete({
        param: { id },
      });
      if (!response.ok) {
        throw new Error(`Could not revoke the invite (${response.status}).`);
      }
    },
    onSuccess: invalidate,
  });

  const pending = invites.data?.filter((row) => row.acceptedAt === null) ?? [];
  const accepted = invites.data?.filter((row) => row.acceptedAt !== null) ?? [];

  return (
    <section className="flex max-w-2xl flex-col gap-3">
      <div className="flex flex-col gap-1">
        <h2 className="text-sm font-medium">Members</h2>
        <p className="text-sm text-muted-foreground">
          This instance is invite-only. Invite by GitHub login; the invite is
          spent the first time that account signs in.
        </p>
      </div>

      <form
        className="flex gap-2"
        onSubmit={(event) => {
          event.preventDefault();
          if (login.trim() !== '') invite.mutate(login.trim());
        }}
      >
        <Input
          value={login}
          onChange={(event) => setLogin(event.target.value)}
          placeholder="GitHub login"
          aria-label="GitHub login"
        />
        <Button
          type="submit"
          disabled={login.trim() === '' || invite.isPending}
        >
          <UserPlusIcon />
          <span>Invite</span>
        </Button>
      </form>

      {invite.error && (
        <p className="text-sm text-destructive">{invite.error.message}</p>
      )}

      {invites.isPending ? (
        <Skeleton className="h-16 w-full rounded-lg" />
      ) : invites.error ? (
        <p className="text-sm text-destructive">{invites.error.message}</p>
      ) : pending.length === 0 && accepted.length === 0 ? (
        <p className="rounded-lg border bg-card p-3 text-sm text-muted-foreground shadow-xs">
          Nobody has been invited yet.
        </p>
      ) : (
        <ul className="flex flex-col gap-1">
          {[...pending, ...accepted].map((row) => (
            <li
              key={row.id}
              className="flex items-center gap-3 rounded-lg border bg-card px-3 py-2 text-card-foreground shadow-xs"
            >
              <span className="flex flex-col gap-0.5">
                <span className="text-sm font-medium">@{row.ghLogin}</span>
                <span className="text-xs text-muted-foreground">
                  {row.acceptedAt === null
                    ? `invited by @${row.invitedBy}`
                    : `joined ${new Date(row.acceptedAt).toLocaleDateString()}`}
                </span>
              </span>
              {row.acceptedAt === null && (
                <Button
                  variant="ghost"
                  size="icon-sm"
                  className="ml-auto"
                  aria-label={`Revoke the invite for ${row.ghLogin}`}
                  disabled={revoke.isPending}
                  onClick={() => revoke.mutate(row.id)}
                >
                  <Trash2Icon />
                </Button>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
