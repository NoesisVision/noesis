import { useEffect, useRef } from 'react';
import type { AgentEntry } from '#backend/app/agent/agent-session.ts';
import { useAgentPanel } from '../agent-panel-context.tsx';
import { useAgentSession } from '../agent.api.ts';
import { AgentBar } from './agent-bar.tsx';
import { AgentCard } from './agent-card.tsx';

/** What brings the conversation into view on its own: something to read or to decide. */
function callsForAttention(entry: AgentEntry | undefined): boolean {
  if (entry === undefined) return false;
  return (
    entry.kind === 'assistant' ||
    entry.kind === 'question' ||
    entry.kind === 'permission' ||
    (entry.kind === 'note' && entry.severity === 'error')
  );
}

/**
 * The agent on a change's pages, where the reader put it: a bar at the foot
 * of the page whose conversation rises as a sheet, or a card over the page
 * that folds to a pill. Either way the conversation comes into view by
 * itself when the agent says something or waits on the person, and stays
 * folded otherwise until asked.
 */
export function AgentSurface() {
  const { placement, open } = useAgentPanel();
  const { data: session } = useAgentSession();
  const last = session?.entries.at(-1);
  const lastId = last?.id;
  const seen = useRef<string | undefined>(undefined);
  useEffect(() => {
    if (lastId === undefined || seen.current === lastId) return;
    const first = seen.current === undefined;
    seen.current = lastId;
    // What was already there when the page opened is history, not news.
    if (!first && callsForAttention(last)) open();
  }, [lastId, last, open]);

  return placement === 'card' ? (
    <AgentCard session={session} />
  ) : (
    <AgentBar session={session} />
  );
}
