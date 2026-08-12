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

interface RightPanelEntry {
  id: string;
  Component: React.ComponentType;
}

const DEFAULT_PROJECT = 'noesis';
const DEFAULT_PROJECTS = [DEFAULT_PROJECT];

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
  children,
}: {
  viewId: string;
  children: React.ReactNode;
}) {
  const [projects, setProjects] = React.useState<string[]>(() => {
    const stored = readShellState<string[]>('projects', DEFAULT_PROJECTS);
    return stored.length > 0 ? stored : DEFAULT_PROJECTS;
  });
  const [project, setProject] = React.useState<string>(() => {
    const stored = readShellState<string | null>('project', null);
    return stored ?? DEFAULT_PROJECT;
  });
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

  const switchProject = React.useCallback((name: string) => {
    setProject(name);
    writeShellState('project', name);
  }, []);

  const addProject = React.useCallback(
    (rawName: string) => {
      const name = rawName.trim();
      if (name === '') return;
      setProjects((prev) => {
        const next = prev.includes(name) ? prev : [...prev, name];
        writeShellState('projects', next);
        return next;
      });
      switchProject(name);
    },
    [switchProject],
  );

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
      project,
      projects,
      switchProject,
      addProject,
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
      project,
      projects,
      switchProject,
      addProject,
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
