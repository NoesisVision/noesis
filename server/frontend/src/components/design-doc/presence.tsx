import type { HocuspocusProvider } from '@hocuspocus/provider';
import * as React from 'react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';

/*
 * Who-is-here (plan phase 4, slice 4): the awareness channel already carries
 * each client's `user` state for the collaboration cursors; this reads the
 * same states into a facepile. One face per account — two tabs of the same
 * person collapse into one.
 */

interface PresenceUser {
  id?: string;
  name?: string;
  color?: string;
  avatarUrl?: string;
}

function readUsers(
  states: Map<number, Record<string, unknown>>,
): PresenceUser[] {
  const byAccount = new Map<string, PresenceUser>();
  for (const state of states.values()) {
    const user = state.user as PresenceUser | undefined;
    if (user === undefined || typeof user.name !== 'string') continue;
    byAccount.set(user.id ?? user.name, user);
  }
  return [...byAccount.values()];
}

export function PresenceFacepile({
  provider,
}: {
  provider: HocuspocusProvider;
}) {
  const [users, setUsers] = React.useState<PresenceUser[]>([]);

  React.useEffect(() => {
    const awareness = provider.awareness;
    if (awareness === null) return;
    const update = () => setUsers(readUsers(awareness.getStates()));
    update();
    awareness.on('update', update);
    return () => awareness.off('update', update);
  }, [provider]);

  if (users.length === 0) return null;
  return (
    <div className="flex items-center -space-x-1.5">
      {users.map((user) => (
        <Avatar
          key={user.id ?? user.name}
          title={user.name}
          className="size-6 border-2 border-background"
          style={{ outline: `2px solid ${user.color ?? 'transparent'}` }}
        >
          <AvatarImage src={user.avatarUrl} alt="" />
          <AvatarFallback className="text-[10px]">
            {(user.name ?? '?').slice(0, 2).toUpperCase()}
          </AvatarFallback>
        </Avatar>
      ))}
    </div>
  );
}
