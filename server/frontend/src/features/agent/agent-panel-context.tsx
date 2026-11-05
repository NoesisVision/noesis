import {
  createContext,
  type ReactNode,
  use,
  useCallback,
  useMemo,
} from 'react';
import { useLocalStorage } from '#/shared/design-system/hooks.ts';

/**
 * Where the conversation is: a bar at the foot of the page whose history
 * rises as a sheet, or a card floating over the page that folds to a pill.
 */
export type AgentPlacement = 'bar' | 'card';

interface AgentPanel {
  placement: AgentPlacement;
  setPlacement: (placement: AgentPlacement) => void;
  /** The conversation is in view: the sheet risen, or the card unfolded. */
  opened: boolean;
  open: () => void;
  close: () => void;
  toggle: () => void;
}

const noop = () => {};

const AgentPanelContext = createContext<AgentPanel>({
  placement: 'bar',
  setPlacement: noop,
  opened: false,
  open: noop,
  close: noop,
  toggle: noop,
});

/** Where the agent sits and whether its conversation is in view, as the reader last left them. */
export function AgentPanelProvider({ children }: { children: ReactNode }) {
  const [placement, setPlacement] = useLocalStorage<AgentPlacement>({
    key: 'noesis.agent.placement',
    defaultValue: 'bar',
    getInitialValueInEffect: false,
  });
  const [opened, setOpened] = useLocalStorage<boolean>({
    key: 'noesis.agent.opened',
    defaultValue: false,
    getInitialValueInEffect: false,
  });
  const open = useCallback(() => setOpened(true), [setOpened]);
  const close = useCallback(() => setOpened(false), [setOpened]);
  const toggle = useCallback(() => setOpened((value) => !value), [setOpened]);
  const value = useMemo(
    () => ({ placement, setPlacement, opened, open, close, toggle }),
    [placement, setPlacement, opened, open, close, toggle],
  );
  return <AgentPanelContext value={value}>{children}</AgentPanelContext>;
}

export function useAgentPanel(): AgentPanel {
  return use(AgentPanelContext);
}
