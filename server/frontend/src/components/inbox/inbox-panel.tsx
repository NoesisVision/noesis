import { useQuery } from '@tanstack/react-query';
import {
  AlarmClockIcon,
  ArrowUpRightIcon,
  BellOffIcon,
  Undo2Icon,
  XIcon,
} from 'lucide-react';
import * as React from 'react';
import { KindIcon } from '@/components/inbox/inbox-bits';
import { KIND_LABELS, STATE_LABELS } from '@/components/inbox/inbox-meta';
import { useInboxActions } from '@/components/inbox/use-inbox-actions';
import { useNow } from '@/components/inbox/use-now';
import {
  PanelBody,
  PanelFields,
  PanelHeading,
  PanelHint,
} from '@/components/shell/right-panel';
import { useShell } from '@/components/shell/use-shell';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Textarea } from '@/components/ui/textarea';
import {
  deferPresets,
  formatAgo,
  formatCountdown,
  formatMoment,
  groupInbox,
  type InboxItem,
  inboxQueryOptions,
} from '@/lib/inbox';

/**
 * The inbox view's right panel: triage detail for the selected item —
 * occurrence history, event timing, the outcome record — and the actions
 * that end an item's stay (defer, dismiss with a reason, promote).
 */
export function InboxPanel() {
  const { project, selection } = useShell();
  if (project === null) {
    return (
      <>
        <PanelHeading>Inbox</PanelHeading>
        <PanelBody>
          <PanelHint>Create a project first.</PanelHint>
        </PanelBody>
      </>
    );
  }
  return (
    <ProjectInboxPanel
      projectId={project.id}
      selectionId={selection?.type === 'inbox-item' ? selection.id : null}
    />
  );
}

function ProjectInboxPanel({
  projectId,
  selectionId,
}: {
  projectId: string;
  selectionId: string | null;
}) {
  const now = useNow();
  const { data: items } = useQuery(inboxQueryOptions(projectId));
  const item = items?.find((candidate) => candidate.id === selectionId);

  if (item === undefined) {
    const groups = groupInbox(items ?? [], now);
    const open = groups.aging.length + groups.current.length;
    return (
      <>
        <PanelHeading>Inbox</PanelHeading>
        <PanelBody>
          <PanelFields
            fields={{
              Open: String(open),
              Snoozed: String(groups.snoozed.length),
              Handled: String(groups.handled.length),
              Expired: String(groups.expired.length),
            }}
          />
          <PanelHint>
            Select an item to see its history and act on it.
          </PanelHint>
        </PanelBody>
      </>
    );
  }

  return <ItemDetail projectId={projectId} item={item} now={now} />;
}

function ItemDetail({
  projectId,
  item,
  now,
}: {
  projectId: string;
  item: InboxItem;
  now: number;
}) {
  const { setSelection } = useShell();
  const actions = useInboxActions(projectId);
  const [dismissOpen, setDismissOpen] = React.useState(false);

  const snoozed =
    item.snoozedUntil !== null && Date.parse(item.snoozedUntil) > now;
  const failure = [
    actions.defer,
    actions.wake,
    actions.promote,
    actions.restore,
  ].find((mutation) => mutation.isError);

  const fields: Record<string, string> = {
    Source: item.origin,
    'First seen': formatMoment(item.firstSeenAt),
    'Last seen': formatAgo(item.lastSeenAt, now),
  };
  if (item.count > 1) fields.Occurrences = `×${item.count}`;
  if (item.dedupKey !== null) fields['Dedup key'] = item.dedupKey;
  if (item.eventStart !== null) fields.Starts = formatMoment(item.eventStart);
  if (snoozed && item.snoozedUntil !== null) {
    fields['Snoozed until'] = formatMoment(item.snoozedUntil);
  }

  return (
    <>
      <PanelHeading
        action={
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label="Clear selection"
            onClick={() => setSelection(null)}
          >
            <XIcon />
          </Button>
        }
      >
        Inbox item
      </PanelHeading>
      <PanelBody>
        <div className="flex items-center gap-2">
          <Badge variant="outline">
            <KindIcon kind={item.kind} className="size-3" />
            {KIND_LABELS[item.kind]}
          </Badge>
          <Badge variant={item.state === 'open' ? 'secondary' : 'outline'}>
            {snoozed ? 'Snoozed' : STATE_LABELS[item.state]}
          </Badge>
        </div>

        <p className="text-sm font-medium">{item.title}</p>

        <PanelFields fields={fields} />

        {item.eventStart !== null && item.state === 'open' && (
          <PanelHint>
            Starts {formatCountdown(item.eventStart, now)}. A snooze cannot pass
            the start.
          </PanelHint>
        )}

        {item.count > 1 && (
          <div className="flex flex-col gap-1 rounded-lg border bg-card p-3 text-xs text-card-foreground shadow-xs">
            <span className="font-medium">Recent occurrences</span>
            {item.occurrences
              .slice(-5)
              .reverse()
              .map((at) => (
                <span key={at} className="text-muted-foreground">
                  {formatMoment(at)}
                </span>
              ))}
          </div>
        )}

        {item.body !== '' && (
          <div className="max-h-56 overflow-y-auto rounded-lg border bg-card p-3 text-sm whitespace-pre-wrap text-card-foreground shadow-xs">
            {item.body}
          </div>
        )}

        <OutcomeBlock item={item} />

        {failure !== undefined && (
          <p className="text-sm text-destructive">{failure.error.message}</p>
        )}

        {item.state === 'open' && (
          <div className="flex flex-wrap gap-2">
            <DropdownMenu>
              <DropdownMenuTrigger
                render={
                  <Button variant="outline" size="sm">
                    <AlarmClockIcon />
                    <span>Defer</span>
                  </Button>
                }
              />
              <DropdownMenuContent align="start">
                {deferPresets(now).map((preset) => {
                  // Bounded by the event's start: a snooze can never skip
                  // past the moment the item exists for.
                  const late =
                    item.eventStart !== null && preset.until >= item.eventStart;
                  return (
                    <DropdownMenuItem
                      key={preset.label}
                      disabled={late}
                      onClick={() =>
                        actions.defer.mutate({
                          itemId: item.id,
                          until: preset.until,
                        })
                      }
                    >
                      {preset.label}
                      {late && (
                        <span className="text-xs text-muted-foreground">
                          after the event starts
                        </span>
                      )}
                    </DropdownMenuItem>
                  );
                })}
              </DropdownMenuContent>
            </DropdownMenu>

            {snoozed && (
              <Button
                variant="outline"
                size="sm"
                disabled={actions.wake.isPending}
                onClick={() => actions.wake.mutate(item.id)}
              >
                <BellOffIcon />
                <span>Wake now</span>
              </Button>
            )}

            <Button
              variant="outline"
              size="sm"
              onClick={() => setDismissOpen(true)}
            >
              <XIcon />
              <span>Dismiss…</span>
            </Button>

            <Button
              size="sm"
              disabled={actions.promote.isPending}
              onClick={() => actions.promote.mutate(item.id)}
            >
              <ArrowUpRightIcon />
              <span>Promote to task</span>
            </Button>
          </div>
        )}

        {item.state === 'dismissed' && (
          <div>
            <Button
              variant="outline"
              size="sm"
              disabled={actions.restore.isPending}
              onClick={() => actions.restore.mutate(item.id)}
            >
              <Undo2Icon />
              <span>Restore to inbox</span>
            </Button>
          </div>
        )}
      </PanelBody>

      <DismissDialog
        projectId={projectId}
        item={item}
        open={dismissOpen}
        onOpenChange={setDismissOpen}
      />
    </>
  );
}

/** What happened to a cleared item, and why — the record §3 demands. */
function OutcomeBlock({ item }: { item: InboxItem }) {
  if (item.outcome === null) return null;
  const { by, at, reason } = item.outcome;
  return (
    <div className="flex flex-col gap-1 rounded-lg border bg-card p-3 text-sm text-card-foreground shadow-xs">
      {item.state === 'dismissed' && (
        <>
          <span className="font-medium">
            Dismissed by {by} · {formatMoment(at)}
          </span>
          <span className="whitespace-pre-wrap text-muted-foreground">
            {reason}
          </span>
        </>
      )}
      {item.state === 'promoted' && (
        <>
          <span className="font-medium">
            Promoted by {by} · {formatMoment(at)}
          </span>
          <span className="text-muted-foreground">
            Waiting for the task module to pick it up.
          </span>
        </>
      )}
      {item.state === 'expired' && (
        <span className="font-medium">
          Expired unhandled · {formatMoment(at)}
        </span>
      )}
    </div>
  );
}

function DismissDialog({
  projectId,
  item,
  open,
  onOpenChange,
}: {
  projectId: string;
  item: InboxItem;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { dismiss } = useInboxActions(projectId);
  const [reason, setReason] = React.useState('');

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) {
          setReason('');
          dismiss.reset();
        }
        onOpenChange(next);
      }}
    >
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Dismiss item</DialogTitle>
          <DialogDescription>
            The reason stays visible to the team, so nobody wonders whether "
            {item.title}" was simply dropped.
          </DialogDescription>
        </DialogHeader>
        <Textarea
          aria-label="Dismissal reason"
          placeholder="Why is this not worth acting on?"
          rows={3}
          value={reason}
          onChange={(event) => setReason(event.target.value)}
        />
        {dismiss.isError && (
          <p className="text-sm text-destructive">{dismiss.error.message}</p>
        )}
        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
          >
            Cancel
          </Button>
          <Button
            type="button"
            disabled={reason.trim() === '' || dismiss.isPending}
            onClick={() =>
              dismiss.mutate(
                { itemId: item.id, reason: reason.trim() },
                { onSuccess: () => onOpenChange(false) },
              )
            }
          >
            Dismiss
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
