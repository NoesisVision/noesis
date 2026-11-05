import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from 'react';
import { registerTools } from '#/shared/web-mcp/web-mcp.ts';
import {
  type ExplorationActions,
  type ExplorationState,
  explorationTools,
} from './exploration-tools.ts';

/** The longest a tool waits for the cards to land before it answers anyway. */
const SETTLE_MS = 5000;

/**
 * A promise that resolves once the diagram is no longer busy — placing or
 * gliding — after what was asked of it has been drawn. It asks for a draw
 * itself, so a change that alters nothing resolves at the next one.
 */
export function useSettled(busy: boolean): () => Promise<void> {
  const waiting = useRef<(() => void)[]>([]);
  const [, draw] = useState(0);
  useEffect(() => {
    if (busy || waiting.current.length === 0) return;
    const done = waiting.current;
    waiting.current = [];
    for (const resolve of done) resolve();
  });
  useEffect(
    () => () => {
      for (const resolve of waiting.current) resolve();
      waiting.current = [];
    },
    [],
  );
  return useCallback(
    () =>
      new Promise<void>((resolve) => {
        const timer = setTimeout(done, SETTLE_MS);
        function done() {
          clearTimeout(timer);
          resolve();
        }
        waiting.current.push(done);
        draw((count) => count + 1);
      }),
    [],
  );
}

/**
 * Offers the exploration's tools to an agent in the browser while `offered`
 * holds, each reading the state and taking the actions as they are when it
 * is called, so the view drawing again does not offer them again.
 */
export function useExplorationTools(
  offered: boolean,
  state: ExplorationState,
  actions: ExplorationActions,
): void {
  const latest = useRef({ state, actions });
  useLayoutEffect(() => {
    latest.current = { state, actions };
  });
  useEffect(() => {
    if (!offered) return;
    const now = () => latest.current.actions;
    return registerTools(
      explorationTools(() => latest.current.state, {
        show: (ids, draw) => now().show(ids, draw),
        showBeside: (ids, from, draw) => now().showBeside(ids, from, draw),
        hide: (ids) => now().hide(ids),
        setRelations: (relations) => now().setRelations(relations),
        select: (ids) => now().select(ids),
        focus: (ids) => now().focus(ids),
        arrange: (direction) => now().arrange(direction),
        undo: () => now().undo(),
        redo: () => now().redo(),
        clear: () => now().clear(),
      }),
    );
  }, [offered]);
}
