import * as React from 'react';
import {
  readShellState,
  writeShellState,
} from '@/components/shell/shell-store';
import {
  clampPanelWidth,
  RIGHT_PANEL_DEFAULT,
  type RightPanelState,
  ShellContext,
  type ShellContextValue,
  type ShellSelection,
} from '@/components/shell/use-shell';
import type { Account, Installation } from '@/lib/auth';
import type { ProjectSummary } from '@/lib/projects';

interface RightPanelEntry {
  id: string;
  Component: React.ComponentType;
}

function rightPanelKey(viewId: string): string {
  return `rightPanel.${viewId}`;
}

function readRightPanel(viewId: string): RightPanelState {
  const stored = readShellState<RightPanelState>(
    rightPanelKey(viewId),
    RIGHT_PANEL_DEFAULT,
  );
  return {
    open: stored.open !== false,
    width: clampPanelWidth(stored.width ?? RIGHT_PANEL_DEFAULT.width),
  };
}

/**
 * Holds the state the shell's parts share: the current project, what the main
 * section has selected, the right panel (content, width, open state) and the
 * command palette. Plain context — no router coupling — so any component
 * inside the shell can take part.
 */
export function ShellProvider({
  viewId,
  account,
  installations,
  projects,
  children,
}: {
  viewId: string;
  account: Account;
  installations: Installation[];
  /** Server data (`/ui/projects`), loaded by the layout — the shell only consumes it. */
  projects: ProjectSummary[];
  children: React.ReactNode;
}) {
  // Only the *selection* persists locally; the projects themselves are the
  // server's. A stored id that no longer exists (deleted elsewhere) falls
  // back to the first project rather than a dead reference.
  const [projectId, setProjectId] = React.useState<string | null>(() =>
    readShellState<string | null>('projectId', null),
  );
  const project =
    projects.find((candidate) => candidate.id === projectId) ??
    projects[0] ??
    null;
  const [selection, setSelection] = React.useState<ShellSelection | null>(null);
  const [entries, setEntries] = React.useState<RightPanelEntry[]>([]);
  const [paletteOpen, setPaletteOpen] = React.useState(false);
  const [rightPanel, setRightPanel] = React.useState<RightPanelState>(() =>
    readRightPanel(viewId),
  );

  // Open/closed and width are remembered per view: a wide inspector on the
  // graph should not force the same width on documents.
  React.useEffect(() => {
    setRightPanel(readRightPanel(viewId));
    setSelection(null);
  }, [viewId]);

  const persistRightPanel = React.useCallback(
    (next: RightPanelState) => {
      setRightPanel(next);
      writeShellState(rightPanelKey(viewId), next);
    },
    [viewId],
  );

  const switchProject = React.useCallback((id: string) => {
    setProjectId(id);
    writeShellState('projectId', id);
  }, []);

  // Registration is a stack: the route registers its default panel on mount,
  // and anything more specific (a selection inspector) registers on top of it.
  // Last one in wins, and unmounting falls back to whatever was underneath.
  const registerRightPanel = React.useCallback(
    (id: string, Component: React.ComponentType) => {
      setEntries((prev) => {
        const existing = prev.find((entry) => entry.id === id);
        if (!existing) return [...prev, { id, Component }];
        if (existing.Component === Component) return prev;
        return prev.map((entry) =>
          entry.id === id ? { id, Component } : entry,
        );
      });
    },
    [],
  );

  const unregisterRightPanel = React.useCallback((id: string) => {
    setEntries((prev) => prev.filter((entry) => entry.id !== id));
  }, []);

  const value = React.useMemo<ShellContextValue>(
    () => ({
      viewId,
      account,
      installations,
      project,
      projects,
      switchProject,
      selection,
      setSelection,
      rightPanel,
      setRightPanelOpen: (open) => persistRightPanel({ ...rightPanel, open }),
      toggleRightPanel: () =>
        persistRightPanel({ ...rightPanel, open: !rightPanel.open }),
      setRightPanelWidth: (width) =>
        persistRightPanel({ ...rightPanel, width: clampPanelWidth(width) }),
      RightPanelContent: entries.at(-1)?.Component ?? null,
      registerRightPanel,
      unregisterRightPanel,
      paletteOpen,
      setPaletteOpen,
      togglePalette: () => setPaletteOpen((open) => !open),
    }),
    [
      viewId,
      account,
      installations,
      project,
      projects,
      switchProject,
      selection,
      rightPanel,
      persistRightPanel,
      entries,
      registerRightPanel,
      unregisterRightPanel,
      paletteOpen,
    ],
  );

  return <ShellContext value={value}>{children}</ShellContext>;
}
