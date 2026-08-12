import { XIcon } from 'lucide-react';
import type * as React from 'react';
import { useShell } from '@/components/shell/use-shell';
import { Button } from '@/components/ui/button';

/** Title row of a right-panel section, matching the top bar's height. */
export function PanelHeading({
  children,
  action,
}: {
  children: React.ReactNode;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex h-10 shrink-0 items-center justify-between gap-2 px-3 text-xs font-medium tracking-wide text-muted-foreground uppercase">
      <span className="truncate">{children}</span>
      {action}
    </div>
  );
}

/** Boxed group of labelled values — the panel's workhorse. */
export function PanelFields({ fields }: { fields: Record<string, string> }) {
  return (
    <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 rounded-lg border bg-card p-3 text-sm text-card-foreground shadow-xs">
      {Object.entries(fields).map(([label, value]) => (
        <div key={label} className="contents">
          <dt className="text-muted-foreground">{label}</dt>
          <dd className="truncate text-right">{value}</dd>
        </div>
      ))}
    </dl>
  );
}

export function PanelHint({ children }: { children: React.ReactNode }) {
  return <p className="text-sm text-muted-foreground">{children}</p>;
}

export function PanelBody({ children }: { children: React.ReactNode }) {
  return <div className="flex flex-col gap-3 px-3 pb-3">{children}</div>;
}

/**
 * Inspector for the current selection. Any view can register it once it puts
 * something in `selection` — the panel content is the same shape whatever the
 * selected thing turns out to be.
 */
export function SelectionInspector() {
  const { selection, setSelection } = useShell();
  if (!selection) return null;

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
        Inspector
      </PanelHeading>
      <PanelBody>
        <p className="text-sm font-medium">{selection.title}</p>
        <PanelFields
          fields={{
            Type: selection.type,
            Id: selection.id,
            ...selection.fields,
          }}
        />
        {selection.detail && <PanelHint>{selection.detail}</PanelHint>}
      </PanelBody>
    </>
  );
}

/**
 * The panel host. Content comes from whatever the active route (or the
 * selection inside it) last registered through `useRightPanel`.
 */
export function RightPanel() {
  const { RightPanelContent } = useShell();

  return (
    <aside
      aria-label="Context panel"
      className="flex h-full flex-col overflow-y-auto bg-background"
    >
      {RightPanelContent ? (
        <RightPanelContent />
      ) : (
        <>
          <PanelHeading>Context</PanelHeading>
          <PanelBody>
            <PanelHint>This view has nothing to show here yet.</PanelHint>
          </PanelBody>
        </>
      )}
    </aside>
  );
}
