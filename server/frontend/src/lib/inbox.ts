import { queryOptions } from '@tanstack/react-query';
import type { InferResponseType } from 'hono/client';
import { client } from '@/client';

// All shapes are inferred from the server's handlers through `AppType`
// (decision 28): a field renamed on the server stops this app from compiling.
export type InboxItem = InferResponseType<
  (typeof client.ui.projects)[':projectId']['inbox']['$get'],
  200
>['items'][number];

export type InboxTab = 'open' | 'handled' | 'expired';

export function inboxKey(projectId: string) {
  return ['ui', 'projects', projectId, 'inbox'] as const;
}

export function inboxQueryOptions(projectId: string) {
  return queryOptions({
    queryKey: inboxKey(projectId),
    queryFn: async (): Promise<InboxItem[]> => {
      const response = await client.ui.projects[':projectId'].inbox.$get({
        param: { projectId },
      });
      if (!response.ok) {
        throw new Error(`Could not load the inbox (${response.status}).`);
      }
      return (await response.json()).items;
    },
    // Countdowns, aging and expiry move with time, and the server sweeps
    // lifecycle state (expire, wake) on every read — so poll.
    refetchInterval: 30_000,
  });
}

/** Maps the inbox write refusals to the sentences the UI shows. */
export function inboxErrorMessage(body: { error?: string }): string {
  switch (body.error) {
    case 'not_found':
      return 'That item is gone. Reload the inbox.';
    case 'invalid_state':
      return 'Someone handled this item in the meantime. The list will catch up.';
    case 'defer_past_event_start':
      return 'A snooze cannot skip past the moment the event starts.';
    default:
      return body.error ?? 'The request failed.';
  }
}

// --- triage grouping ------------------------------------------------------

/** Open items older than this are hoisted into the pinned aging section. */
export const AGING_DAYS = 4;
/** An event this close is imminent — its countdown turns loud. */
export const IMMINENT_HOURS = 6;

const HOUR_MS = 3_600_000;
const DAY_MS = 24 * HOUR_MS;

export interface InboxGroups {
  /** Open, unsnoozed, waiting longer than AGING_DAYS — pinned on top. */
  aging: InboxItem[];
  /** The main open list, newest activity first (server order). */
  current: InboxItem[];
  /** Deferred items, shown dimmed with their wake time. */
  snoozed: InboxItem[];
  /** Dismissed and promoted — cleared, with the "why" kept. */
  handled: InboxItem[];
  /** Events whose moment passed unhandled — missed, distinct from handled. */
  expired: InboxItem[];
}

export function groupInbox(items: InboxItem[], now: number): InboxGroups {
  const groups: InboxGroups = {
    aging: [],
    current: [],
    snoozed: [],
    handled: [],
    expired: [],
  };
  for (const item of items) {
    if (item.state === 'expired') {
      groups.expired.push(item);
    } else if (item.state !== 'open') {
      groups.handled.push(item);
    } else if (
      item.snoozedUntil !== null &&
      Date.parse(item.snoozedUntil) > now
    ) {
      groups.snoozed.push(item);
    } else if (ageDays(item, now) > AGING_DAYS) {
      groups.aging.push(item);
    } else {
      groups.current.push(item);
    }
  }
  return groups;
}

export function ageDays(item: InboxItem, now: number): number {
  return (now - Date.parse(item.firstSeenAt)) / DAY_MS;
}

export function isImminent(item: InboxItem, now: number): boolean {
  return (
    item.eventStart !== null &&
    Date.parse(item.eventStart) - now < IMMINENT_HOURS * HOUR_MS
  );
}

// --- time formatting ------------------------------------------------------

export function formatAgo(iso: string, now: number): string {
  const ms = Math.max(0, now - Date.parse(iso));
  if (ms < 60_000) return 'just now';
  if (ms < HOUR_MS) return `${Math.floor(ms / 60_000)}m ago`;
  if (ms < DAY_MS) return `${Math.floor(ms / HOUR_MS)}h ago`;
  return `${Math.floor(ms / DAY_MS)}d ago`;
}

/** How long an open item has been waiting, for the age chips. */
export function formatWaiting(item: InboxItem, now: number): string {
  const days = Math.floor(ageDays(item, now));
  if (days > AGING_DAYS) return `Waiting for ${days} days`;
  if (days >= 1) return `${days}d waiting`;
  return formatAgo(item.firstSeenAt, now);
}

export function formatCountdown(iso: string, now: number): string {
  const ms = Date.parse(iso) - now;
  if (ms <= 0) return 'started';
  if (ms < HOUR_MS) return `in ${Math.max(1, Math.floor(ms / 60_000))}m`;
  if (ms < DAY_MS) {
    const hours = Math.floor(ms / HOUR_MS);
    const minutes = Math.floor((ms % HOUR_MS) / 60_000);
    return minutes > 0 ? `in ${hours}h ${minutes}m` : `in ${hours}h`;
  }
  return `in ${Math.floor(ms / DAY_MS)}d`;
}

export function formatMoment(iso: string): string {
  return new Date(iso).toLocaleString([], {
    dateStyle: 'medium',
    timeStyle: 'short',
  });
}

// --- defer presets --------------------------------------------------------

export interface DeferPreset {
  label: string;
  until: string;
}

export function deferPresets(now: number): DeferPreset[] {
  const tomorrow = new Date(now + DAY_MS);
  tomorrow.setHours(9, 0, 0, 0);
  const nextMonday = new Date(now);
  nextMonday.setDate(
    nextMonday.getDate() + ((8 - nextMonday.getDay()) % 7 || 7),
  );
  nextMonday.setHours(9, 0, 0, 0);
  return [
    {
      label: 'Later today (+4h)',
      until: new Date(now + 4 * HOUR_MS).toISOString(),
    },
    { label: 'Tomorrow 09:00', until: tomorrow.toISOString() },
    { label: 'Next week (Mon 09:00)', until: nextMonday.toISOString() },
  ];
}
