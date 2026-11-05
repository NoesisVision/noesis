import { useNavigate } from '@tanstack/react-router';
import { useEffect, useLayoutEffect, useRef } from 'react';
import { z } from 'zod';
import { useDevToolsContext } from '#/shared/dev-tools/dev-tools-context.tsx';
import {
  registerTools,
  type WebTool,
  webTool,
  whenOffered,
} from '#/shared/web-mcp/web-mcp.ts';
import { SEARCH_ELEMENTS } from './exploration/exploration-tools.ts';

/** The longest the way to the exploration waits for its tools to be offered. */
const READY_MS = 10_000;

/*
 * The way to the system model offered to an agent in the browser from any
 * page, so it can open the exploration whose own tools are offered only
 * while it is open (exploration/exploration-tools.ts).
 */

export function systemModelTools(
  open: () => Promise<void>,
  /** Whether the exploration's tools came to be offered, waited for. */
  ready: () => Promise<boolean>,
): WebTool[] {
  return [
    webTool({
      name: 'open_system_model_exploration',
      description:
        "Opens the exploration of the scanned system model: a diagram of its modules, building blocks and behaviors and how they relate. Once it is open, the page offers the exploration's own tools — find_diagram_element_ids, describe_element, show_elements, show_chain, get_diagram and the rest — to read the model and change what the diagram draws.",
      input: z.object({}),
      run: async () => {
        await open();
        if (await ready())
          return 'The system model exploration is open, and its tools are offered: start with get_diagram, or find_diagram_element_ids to draw more.';
        return `The system model exploration is open, but its tools were not offered within ${READY_MS / 1000} seconds. The project may not have been scanned yet — the page then offers a Scan button to the reader — or the model failed to load.`;
      },
    }),
  ];
}

/** Offers the way to the exploration while the dev tools flag is on. */
export function useSystemModelTools(): void {
  const {
    features: { webMcpTools },
  } = useDevToolsContext();
  const navigate = useNavigate();
  const latest = useRef(navigate);
  useLayoutEffect(() => {
    latest.current = navigate;
  });
  useEffect(() => {
    if (!webMcpTools) return;
    return registerTools(
      systemModelTools(
        () =>
          latest.current({
            to: '/system-model',
            search: { view: 'exploration' },
          }),
        () => whenOffered(SEARCH_ELEMENTS, READY_MS),
      ),
    );
  }, [webMcpTools]);
}
