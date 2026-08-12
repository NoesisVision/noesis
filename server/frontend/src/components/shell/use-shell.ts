import * as React from 'react';

// What the main section hands to the right panel when the user picks
// something. Deliberately shallow: the inspector renders a title and a set of
// labelled fields, whatever the entity turns out to be.
export interface ShellSelection {
  type: string;
  id: string;
  title: string;
  fields?: Record<string, string>;
  detail?: string;
}

export interface RightPanelState {
  open: boolean;
  width: number;
}

export const RIGHT_PANEL_MIN_WIDTH = 220;
export const RIGHT_PANEL_MAX_WIDTH = 480;
export const RIGHT_PANEL_DEFAULT: RightPanelState = { open: true, width: 300 };

export function clampPanelWidth(width: number): number {
  if (!Number.isFinite(width)) return RIGHT_PANEL_DEFAULT.width;
  return Math.min(
    RIGHT_PANEL_MAX_WIDTH,
    Math.max(RIGHT_PANEL_MIN_WIDTH, width),
  );
}

export interface ShellContextValue {
  viewId: string;
  project: string;
  projects: string[];
  switchProject: (name: string) => void;
  addProject: (name: string) => void;
  selection: ShellSelection | null;
  setSelection: (selection: ShellSelection | null) => void;
  rightPanel: RightPanelState;
  setRightPanelOpen: (open: boolean) => void;
  toggleRightPanel: () => void;
  setRightPanelWidth: (width: number) => void;
  RightPanelContent: React.ComponentType | null;
  registerRightPanel: (id: string, Component: React.ComponentType) => void;
  unregisterRightPanel: (id: string) => void;
  paletteOpen: boolean;
  setPaletteOpen: (open: boolean) => void;
  togglePalette: () => void;
}

export const ShellContext = React.createContext<ShellContextValue | null>(null);

export function useShell(): ShellContextValue {
  const context = React.useContext(ShellContext);
  if (!context) throw new Error('useShell must be used within a ShellProvider');
  return context;
}

/**
 * Registers the right panel's content for as long as the calling component is
 * mounted.
 *
 * Takes a component type rather than a rendered node on purpose: a stable
 * (module-level) component keeps the effect from re-registering on every
 * render, while still re-rendering freely against context and its own state.
 *
 * Registrations stack, so a selection inspector mounted inside a view refines
 * that view's default panel and the default returns when it unmounts.
 */
export function useRightPanel(Component: React.ComponentType): void {
  const id = React.useId();
  const { registerRightPanel, unregisterRightPanel } = useShell();

  React.useEffect(() => {
    registerRightPanel(id, Component);
    return () => unregisterRightPanel(id);
  }, [id, Component, registerRightPanel, unregisterRightPanel]);
}
