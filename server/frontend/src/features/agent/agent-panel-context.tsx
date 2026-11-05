import {
  createContext,
  type ReactNode,
  use,
  useCallback,
  useMemo,
  useState,
} from 'react';
import { useLocalStorage } from '#/shared/design-system/hooks.ts';

interface AgentPanel {
  opened: boolean;
  /** Opens the panel; with `draft`, the composer starts from that text. */
  open: (draft?: string) => void;
  close: () => void;
  toggle: () => void;
  /** What the composer holds: kept here so a view can put words in it. */
  text: string;
  setText: (text: string) => void;
  /** Counts the drafts views handed over, so the composer knows a new one came. */
  draftCount: number;
}

const noop = () => {};

const AgentPanelContext = createContext<AgentPanel>({
  opened: false,
  open: noop,
  close: noop,
  toggle: noop,
  text: '',
  setText: noop,
  draftCount: 0,
});

/**
 * Whether the agent's panel is open beside the page, as the reader last left
 * it, and what its composer holds: a button on a design document opens the
 * panel with the skill's invocation already written, for the person to add
 * to and send.
 */
export function AgentPanelProvider({ children }: { children: ReactNode }) {
  const [opened, setOpened] = useLocalStorage<boolean>({
    key: 'noesis.agent.panel-opened',
    defaultValue: false,
    getInitialValueInEffect: false,
  });
  const [text, setText] = useState('');
  const [draftCount, setDraftCount] = useState(0);
  const open = useCallback(
    (draft?: string) => {
      if (draft !== undefined) {
        // Unsent words are kept, after the invocation, which must come first.
        setText((current) =>
          current.trim() === '' ? draft : `${draft}\n${current}`,
        );
        setDraftCount((count) => count + 1);
      }
      setOpened(true);
    },
    [setOpened],
  );
  const close = useCallback(() => setOpened(false), [setOpened]);
  const toggle = useCallback(() => setOpened((value) => !value), [setOpened]);
  const value = useMemo(
    () => ({ opened, open, close, toggle, text, setText, draftCount }),
    [opened, open, close, toggle, text, draftCount],
  );
  return <AgentPanelContext value={value}>{children}</AgentPanelContext>;
}

export function useAgentPanel(): AgentPanel {
  return use(AgentPanelContext);
}
