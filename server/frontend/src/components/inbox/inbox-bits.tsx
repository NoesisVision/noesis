import { KIND_ICONS } from '@/components/inbox/inbox-meta';
import { Badge } from '@/components/ui/badge';
import {
  AGING_DAYS,
  ageDays,
  formatCountdown,
  formatWaiting,
  type InboxItem,
  isImminent,
} from '@/lib/inbox';
import { cn } from '@/lib/utils';

export function KindIcon({
  kind,
  className,
}: {
  kind: InboxItem['kind'];
  className?: string;
}) {
  const Icon = KIND_ICONS[kind];
  return <Icon aria-hidden="true" className={cn('size-4', className)} />;
}

/**
 * Age, made loud in steps (inbox.md §3): quiet muted text under a day, a
 * tinted chip from one day, a solid primary chip past AGING_DAYS.
 */
export function AgeChip({ item, now }: { item: InboxItem; now: number }) {
  const days = ageDays(item, now);
  if (days < 1) {
    return (
      <span className="text-xs whitespace-nowrap text-muted-foreground">
        {formatWaiting(item, now)}
      </span>
    );
  }
  if (days <= AGING_DAYS) {
    return (
      <Badge className="bg-primary/15 text-primary" variant="secondary">
        {formatWaiting(item, now)}
      </Badge>
    );
  }
  return <Badge>{formatWaiting(item, now)}</Badge>;
}

/** Time remaining on an event; loud once the start is imminent. */
export function CountdownChip({ item, now }: { item: InboxItem; now: number }) {
  if (item.eventStart === null || item.state !== 'open') return null;
  return (
    <Badge
      variant={isImminent(item, now) ? 'secondary' : 'outline'}
      className={cn(isImminent(item, now) && 'bg-primary/15 text-primary')}
    >
      {formatCountdown(item.eventStart, now)}
    </Badge>
  );
}
