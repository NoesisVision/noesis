import { v7 as uuidv7 } from 'uuid';
import type { Clock } from '#backend/app/clock';
import {
  type AgentEntry,
  type AgentMode,
  type AgentSession,
  type AgentStatus,
} from './agent-session';
import type { AgentTask } from './agent-task';

export type AgentSessionListener = (session: AgentSession) => void;

type WithoutStamp<E> = E extends AgentEntry ? Omit<E, 'id' | 'at'> : never;
/** A new entry without what the transcript stamps on it. */
export type NewEntry = WithoutStamp<AgentEntry>;

/**
 * The one record of a session that both the page and the host read and
 * write: the hosts append to it as the session speaks, the routes read it
 * back and follow it. Listeners get the whole session on every change,
 * coalesced, since a streaming reply changes it many times a second.
 */
export class AgentTranscript {
  private readonly listeners = new Set<AgentSessionListener>();
  private readonly clock: Clock;
  private readonly mode: AgentMode;
  private status: AgentStatus;
  private sessionId: string | null = null;
  private hint: string | null = null;
  private entries: AgentEntry[] = [];
  private scheduled: ReturnType<typeof setTimeout> | undefined;

  constructor(mode: AgentMode, status: AgentStatus, clock: Clock) {
    this.mode = mode;
    this.status = status;
    this.clock = clock;
  }

  view(): AgentSession {
    return {
      mode: this.mode,
      status: this.status,
      sessionId: this.sessionId,
      hint: this.hint,
      entries: this.entries,
    };
  }

  subscribe(listener: AgentSessionListener): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  append(entry: NewEntry): AgentEntry {
    const stamped = {
      ...entry,
      id: uuidv7(),
      at: this.clock.now(),
    } as AgentEntry;
    this.entries = [...this.entries, stamped];
    this.changed();
    return stamped;
  }

  /** Replaces one entry by its id, through `patch`; nothing when the id is not here. */
  update(id: string, patch: (entry: AgentEntry) => AgentEntry): void {
    const index = this.entries.findIndex((entry) => entry.id === id);
    if (index === -1) return;
    const current = this.entries[index] as AgentEntry;
    this.entries = this.entries.with(index, patch(current));
    this.changed();
  }

  find<K extends AgentEntry['kind']>(
    kind: K,
    match: (entry: Extract<AgentEntry, { kind: K }>) => boolean,
  ): Extract<AgentEntry, { kind: K }> | undefined {
    return this.entries.find(
      (entry): entry is Extract<AgentEntry, { kind: K }> =>
        entry.kind === kind && match(entry as Extract<AgentEntry, { kind: K }>),
    );
  }

  /** What the last message sent was about; null before one, or off a change. */
  lastTask(): AgentTask | null {
    const last = this.entries.findLast((entry) => entry.kind === 'user');
    return last?.kind === 'user' ? last.task : null;
  }

  setStatus(status: AgentStatus, hint: string | null = null): void {
    this.status = status;
    this.hint = hint;
    this.changed();
  }

  setSessionId(sessionId: string): void {
    this.sessionId = sessionId;
    this.changed();
  }

  note(text: string, severity: 'info' | 'error' = 'info'): void {
    this.append({ kind: 'note', text, severity });
  }

  /** One notification per tick, however many changes land in it. */
  private changed(): void {
    if (this.scheduled !== undefined) return;
    this.scheduled = setTimeout(() => {
      this.scheduled = undefined;
      const session = this.view();
      for (const listener of this.listeners) listener(session);
    }, 40);
  }
}
