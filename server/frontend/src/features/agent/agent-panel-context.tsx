import {
  createContext,
  type ReactNode,
  use,
  useCallback,
  useMemo,
} from 'react';
import { useLocalStorage } from '#/shared/design-system/hooks.ts';

interface AgentPanel {
  opened: boolean;
  open: () => void;
  close: () => void;
  toggle: () => void;
}

const noop = () => {};

const AgentPanelContext = createContext<AgentPanel>({
  opened: false,
  open: noop,
  close: noop,
  toggle: noop,
});

/** Whether the agent's panel is open beside the page, as the reader last left it. */
export function AgentPanelProvider({ children }: { children: ReactNode }) {
  const [opened, setOpened] = useLocalStorage<boolean>({
    key: 'noesis.agent.panel-opened',
    defaultValue: false,
    getInitialValueInEffect: false,
  });
  const open = useCallback(() => setOpened(true), [setOpened]);
  const close = useCallback(() => setOpened(false), [setOpened]);
  const toggle = useCallback(() => setOpened((value) => !value), [setOpened]);
  const value = useMemo(
    () => ({ opened, open, close, toggle }),
    [opened, open, close, toggle],
  );
  return <AgentPanelContext value={value}>{children}</AgentPanelContext>;
}

export function useAgentPanel(): AgentPanel {
  return use(AgentPanelContext);
}
