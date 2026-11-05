import {
  queryOptions,
  useMutation,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query';
import { useEffect } from 'react';
import { api } from '#/shared/api/client.ts';
import { uiLogger } from '#/shared/logging.ts';
import type {
  AgentAttachment,
  AgentSession,
  PermissionDecision,
} from '#backend/app/agent/agent-session.ts';
import type { AgentTask } from '#backend/app/agent/agent-task.ts';
import {
  isTextFile,
  MAX_ATTACHMENT_BYTES,
  safeFileName,
} from './agent.model.ts';

const log = uiLogger('agent');

const AGENT_KEY = ['agent'] as const;
/** The stream's address, spelled out: an `EventSource` takes a path, not the typed client. */
const AGENT_EVENTS_URL = '/ui/agent/events';

const agentSession = queryOptions({
  queryKey: AGENT_KEY,
  queryFn: async ({ signal }): Promise<AgentSession> => {
    const data = await api.agent.$get({}, { init: { signal } });
    return data.session;
  },
  // The stream below keeps it fresh; a refetch would only race it.
  staleTime: 'static',
});

/**
 * The session as it stands, kept current by the service's event stream: every
 * change lands in the query's cache, so whoever reads the query follows the
 * session without asking again. The stream also says when the agent has
 * written to the graph — a tool call ended — so the page re-reads what it
 * shows.
 */
export function useAgentSession() {
  const queryClient = useQueryClient();
  const query = useQuery(agentSession);
  useEffect(() => {
    const source = new EventSource(AGENT_EVENTS_URL);
    let toolsSeen = 0;
    source.addEventListener('session', (event: MessageEvent<string>) => {
      const session = JSON.parse(event.data) as AgentSession;
      queryClient.setQueryData(AGENT_KEY, session);
      const settled = session.entries.filter(
        (entry) => entry.kind === 'tool' && entry.state !== 'running',
      ).length;
      if (settled !== toolsSeen) {
        toolsSeen = settled;
        void queryClient.invalidateQueries({ queryKey: ['changes'] });
      }
    });
    source.onerror = () => {
      log.warn('the agent event stream dropped; the browser reconnects it');
    };
    return () => source.close();
  }, [queryClient]);
  return query;
}

interface SentMessage {
  text: string;
  attachments: AgentAttachment[];
  task: AgentTask | undefined;
}

export function useSendAgentMessage() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (message: SentMessage) => {
      const data = await api.agent.messages.$post({ json: message });
      return data.session;
    },
    onSuccess: (session) => queryClient.setQueryData(AGENT_KEY, session),
  });
}

export function useAnswerAgentQuestion() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (answer: {
      toolUseId: string;
      answers: Record<string, string>;
    }) => {
      const data = await api.agent.answers.$post({ json: answer });
      return data.session;
    },
    onSuccess: (session) => queryClient.setQueryData(AGENT_KEY, session),
  });
}

export function useDecideAgentPermission() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (decision: {
      toolUseId: string;
      decision: PermissionDecision;
    }) => {
      const data = await api.agent.decisions.$post({ json: decision });
      return data.session;
    },
    onSuccess: (session) => queryClient.setQueryData(AGENT_KEY, session),
  });
}

export function useInterruptAgent() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      const data = await api.agent.interrupt.$post({ json: {} });
      return data.session;
    },
    onSuccess: (session) => queryClient.setQueryData(AGENT_KEY, session),
  });
}

class AttachmentTooLargeError extends Error {
  constructor(name: string) {
    super(`${name} is larger than 3 MiB.`);
    this.name = 'AttachmentTooLargeError';
  }
}

/**
 * Hands one of the person's files to the service, which keeps it in the
 * session's scratch directory and answers with the path the agent reads it
 * by. Text goes as it is, anything else as base64.
 */
export function useUploadAgentFile() {
  return useMutation({
    mutationFn: async (file: File): Promise<AgentAttachment> => {
      if (file.size > MAX_ATTACHMENT_BYTES) {
        throw new AttachmentTooLargeError(file.name);
      }
      const text = isTextFile(file);
      const data = await api.agent.files.$post({
        json: {
          name: safeFileName(file.name),
          encoding: text ? 'utf8' : 'base64',
          content: text ? await file.text() : await base64Of(file),
        },
      });
      return data.attachment;
    },
  });
}

/** Base64 of the file's bytes, through `btoa` a slice at a time: one call cannot take a whole file. */
async function base64Of(file: File): Promise<string> {
  const bytes = new Uint8Array(await file.arrayBuffer());
  const slice = 0x8000;
  let binary = '';
  for (let i = 0; i < bytes.length; i += slice) {
    binary += String.fromCharCode(...bytes.subarray(i, i + slice));
  }
  return btoa(binary);
}
