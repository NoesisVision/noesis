import { useQuery } from '@tanstack/react-query';
import { createFileRoute } from '@tanstack/react-router';
import { InboxIcon, PlusIcon } from 'lucide-react';
import * as React from 'react';
import { CaptureDialog } from '@/components/inbox/capture-dialog';
import {
  AgeChip,
  CountdownChip,
  KindIcon,
} from '@/components/inbox/inbox-bits';
import { InboxPanel } from '@/components/inbox/inbox-panel';
import { useNow } from '@/components/inbox/use-now';
import { PlaceholderView } from '@/components/shell/placeholder-view';
import { useRightPanel, useShell } from '@/components/shell/use-shell';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import {
  AGING_DAYS,
  ageDays,
  formatAgo,
  formatMoment,
  groupInbox,
  type InboxItem,
  type InboxTab,
  inboxQueryOptions,
} from '@/lib/inbox';
import { cn } from '@/lib/utils';

export const Route = createFileRoute('/_shell/inbox')({
  component: InboxView,
  staticData: { breadcrumb: 'Inbox', viewId: 'inbox' },
});

export function InboxView() {
  const { project } = useShell();
  useRightPanel(InboxPanel);

  if (project === null) {
    return (
      <PlaceholderView
        title="Inbox"
        description="The team inbox is per project. Create a project first."
      />
    );
  }
  return <ProjectInbox key={project.id} projectId={project.id} />;
}

function ProjectInbox({ projectId }: { projectId: string }) {
  const now = useNow();
  const items = useQuery(inboxQueryOptions(projectId));
  const [tab, setTab] = React.useState<InboxTab>('open');
  const [captureOpen, setCaptureOpen] = React.useState(false);

  const groups = groupInbox(items.data ?? [], now);
  const openCount =
    groups.aging.length + groups.current.length + groups.snoozed.length;

  return (
    <div className="flex flex-col gap-4 p-6">
      <div className="flex flex-wrap items-center gap-2">
        <h1 className="text-xl font-semibold tracking-tight">Inbox</h1>
        <p className="w-full text-sm text-muted-foreground sm:order-last">
          Every signal the team must react to, in one place — until it is
          promoted, dismissed with a reason, or expired.
        </p>
        {/* biome-ignore lint/a11y/useSemanticElements: a fieldset styles poorly as a segmented control; role="group" carries the same semantics (shell-prototype precedent). */}
        <div
          className="ml-auto flex items-center gap-1 rounded-lg border p-0.5"
          role="group"
          aria-label="Inbox sections"
        >
          <TabButton
            tab="open"
            current={tab}
            count={openCount}
            onPick={setTab}
          />
          <TabButton
            tab="handled"
            current={tab}
            count={groups.handled.length}
            onPick={setTab}
          />
          <TabButton
            tab="expired"
            current={tab}
            count={groups.expired.length}
            onPick={setTab}
          />
        </div>
        <Button size="sm" onClick={() => setCaptureOpen(true)}>
          <PlusIcon />
          <span>Capture</span>
        </Button>
      </div>

      {items.isPending ? (
        <div className="flex flex-col gap-2">
          <Skeleton className="h-14" />
          <Skeleton className="h-14" />
          <Skeleton className="h-14" />
        </div>
      ) : items.isError ? (
        <p className="rounded-lg border bg-card p-3 text-sm text-destructive shadow-xs">
          {items.error.message}
        </p>
      ) : (
        <div className="flex flex-col gap-5">
          {tab === 'open' && <OpenTab groups={groups} now={now} />}
          {tab === 'handled' && <HandledTab items={groups.handled} now={now} />}
          {tab === 'expired' && <ExpiredTab items={groups.expired} now={now} />}
        </div>
      )}

      <CaptureDialog
        projectId={projectId}
        open={captureOpen}
        onOpenChange={setCaptureOpen}
      />
    </div>
  );
}

const TAB_LABELS: Record<InboxTab, string> = {
  open: 'Open',
  handled: 'Handled',
  expired: 'Expired',
};

function TabButton({
  tab,
  current,
  count,
  onPick,
}: {
  tab: InboxTab;
  current: InboxTab;
  count: number;
  onPick: (tab: InboxTab) => void;
}) {
  return (
    <Button
      variant={tab === current ? 'secondary' : 'ghost'}
      size="sm"
      aria-pressed={tab === current}
      onClick={() => onPick(tab)}
    >
      <span>{TAB_LABELS[tab]}</span>
      <span className="text-xs text-muted-foreground">{count}</span>
    </Button>
  );
}

function OpenTab({
  groups,
  now,
}: {
  groups: ReturnType<typeof groupInbox>;
  now: number;
}) {
  const empty = groups.aging.length === 0 && groups.current.length === 0;
  return (
    <>
      {groups.aging.length > 0 && (
        <ItemGroup
          label="Aging — do not let these sink"
          items={groups.aging}
          now={now}
        />
      )}

      {empty ? (
        <div className="flex flex-col items-center gap-2 rounded-xl border border-dashed p-10 text-center">
          <InboxIcon className="size-6 text-muted-foreground" />
          <p className="text-sm font-medium">Inbox zero</p>
          <p className="text-sm text-muted-foreground">
            {groups.snoozed.length === 0
              ? 'Nothing is waiting for the team.'
              : `Nothing is waiting right now — ${groups.snoozed.length} snoozed ${
                  groups.snoozed.length === 1 ? 'item' : 'items'
                } will return.`}
          </p>
        </div>
      ) : (
        <ItemGroup items={groups.current} now={now} />
      )}

      {groups.snoozed.length > 0 && (
        <ItemGroup
          label="Snoozed — will return"
          items={groups.snoozed}
          now={now}
          dimmed
        />
      )}
    </>
  );
}

function HandledTab({ items, now }: { items: InboxItem[]; now: number }) {
  if (items.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        Nothing handled yet. Dismissals (with their reasons) and promotions land
        here.
      </p>
    );
  }
  return <ItemGroup items={items} now={now} />;
}

function ExpiredTab({ items, now }: { items: InboxItem[]; now: number }) {
  if (items.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        No missed events. An event that passes unhandled retires here — visible
        as missed, distinct from handled.
      </p>
    );
  }
  return <ItemGroup items={items} now={now} />;
}

function ItemGroup({
  label,
  items,
  now,
  dimmed = false,
}: {
  label?: string;
  items: InboxItem[];
  now: number;
  dimmed?: boolean;
}) {
  if (items.length === 0) return null;
  return (
    <section className="flex flex-col gap-2">
      {label !== undefined && (
        <h2 className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
          {label}
        </h2>
      )}
      <ul className={cn('flex flex-col gap-1.5', dimmed && 'opacity-60')}>
        {items.map((item) => (
          <ItemRow key={item.id} item={item} now={now} />
        ))}
      </ul>
    </section>
  );
}

function ItemRow({ item, now }: { item: InboxItem; now: number }) {
  const { selection, setSelection, setRightPanelOpen } = useShell();
  const selected = selection?.type === 'inbox-item' && selection.id === item.id;
  const waitingDays = ageDays(item, now);
  const snoozed =
    item.snoozedUntil !== null && Date.parse(item.snoozedUntil) > now;

  return (
    <li>
      <button
        type="button"
        aria-pressed={selected}
        onClick={() => {
          setSelection({ type: 'inbox-item', id: item.id, title: item.title });
          setRightPanelOpen(true);
        }}
        className={cn(
          'flex w-full items-center gap-3 rounded-lg border bg-card px-3 py-2.5 text-left text-card-foreground shadow-xs transition-colors hover:bg-muted/50',
          // The age rail: waiting items carry the shell's one accent.
          item.state === 'open' && !snoozed && waitingDays >= 1
            ? 'border-l-3 border-l-primary'
            : undefined,
          selected && 'border-ring ring-1 ring-ring/50',
        )}
      >
        <KindIcon kind={item.kind} className="shrink-0 text-muted-foreground" />
        <span className="flex min-w-0 flex-1 flex-col gap-0.5">
          <span className="truncate text-sm font-medium">{item.title}</span>
          <span className="truncate text-xs text-muted-foreground">
            {rowMeta(item, now, snoozed)}
          </span>
        </span>
        {item.count > 1 && (
          <Badge variant="secondary" aria-label={`${item.count} occurrences`}>
            ×{item.count}
          </Badge>
        )}
        <CountdownChip item={item} now={now} />
        {item.state === 'open' && !snoozed && waitingDays >= 1 && (
          <AgeChip item={item} now={now} />
        )}
      </button>
    </li>
  );
}

function rowMeta(item: InboxItem, now: number, snoozed: boolean): string {
  if (snoozed && item.snoozedUntil !== null) {
    return `${item.origin} · wakes ${formatMoment(item.snoozedUntil)}`;
  }
  if (item.state === 'dismissed' && item.outcome !== null) {
    return `Dismissed by ${item.outcome.by} — ${item.outcome.reason ?? ''}`;
  }
  if (item.state === 'promoted' && item.outcome !== null) {
    return `Promoted by ${item.outcome.by} · waiting for the task module`;
  }
  if (item.state === 'expired' && item.eventStart !== null) {
    return `Missed · started ${formatAgo(item.eventStart, now)}`;
  }
  const age =
    ageDays(item, now) > AGING_DAYS
      ? formatMoment(item.firstSeenAt)
      : formatAgo(item.lastSeenAt, now);
  return `${item.origin} · ${age}`;
}
