import { z } from 'zod';
import { DesignTask } from './design-task';

/**
 * How the page reaches a Claude Code session. `embedded`: the service started
 * one of its own, beside the page, and drives it through the Agent SDK.
 * `attached`: an agent session started the service over stdio, so the page
 * speaks into that session instead of starting another.
 */
export const AgentMode = z.enum(['embedded', 'attached']);
export type AgentMode = z.infer<typeof AgentMode>;

/**
 * `waiting` is the session's turn held for the person: a question to answer
 * or a tool to allow. `stopped` is a session that ended on its own; `failed`
 * one that could not start or broke.
 */
export const AgentStatus = z.enum([
  'starting',
  'idle',
  'working',
  'waiting',
  'stopped',
  'failed',
]);
export type AgentStatus = z.infer<typeof AgentStatus>;

/** A file the person handed the session: written to the scratch directory and named to the agent by its path. */
export const AgentAttachment = z.object({
  name: z.string().min(1),
  path: z.string().min(1),
});
export type AgentAttachment = z.infer<typeof AgentAttachment>;

/** One of the questions an `AskUserQuestion` call asks, as the tool shapes it. */
export const AgentQuestion = z.object({
  question: z.string(),
  header: z.string(),
  multiSelect: z.boolean(),
  options: z.array(z.object({ label: z.string(), description: z.string() })),
});
export type AgentQuestion = z.infer<typeof AgentQuestion>;

export const PermissionDecision = z.enum(['allow', 'allowAlways', 'deny']);
export type PermissionDecision = z.infer<typeof PermissionDecision>;

const entry = { id: z.string(), at: z.iso.datetime() };

/**
 * What the transcript holds, in order: what the person sent, what the agent
 * said, the tools it ran, the questions and permissions it waited on, and
 * the notes the service adds about the session itself.
 */
export const AgentEntry = z.discriminatedUnion('kind', [
  z.object({
    ...entry,
    kind: z.literal('user'),
    text: z.string(),
    attachments: z.array(AgentAttachment),
    /** What the page was about; null off a change. */
    task: DesignTask.nullable(),
    /** The message started the task's skill, which the session read at its head. */
    starts: z.boolean(),
  }),
  z.object({
    ...entry,
    kind: z.literal('assistant'),
    text: z.string(),
    /** Still arriving: the text grows until the turn's message is complete. */
    streaming: z.boolean(),
  }),
  z.object({
    ...entry,
    kind: z.literal('tool'),
    toolUseId: z.string(),
    tool: z.string(),
    summary: z.string(),
    state: z.enum(['running', 'done', 'failed']),
  }),
  z.object({
    ...entry,
    kind: z.literal('question'),
    toolUseId: z.string(),
    questions: z.array(AgentQuestion),
    /** By question text; null while the person has not answered. */
    answers: z.record(z.string(), z.string()).nullable(),
  }),
  z.object({
    ...entry,
    kind: z.literal('permission'),
    toolUseId: z.string(),
    tool: z.string(),
    summary: z.string(),
    /** All of what the call would do, uncut: what an approval covers. */
    detail: z.string(),
    decision: PermissionDecision.nullable(),
  }),
  z.object({
    ...entry,
    kind: z.literal('note'),
    text: z.string(),
    severity: z.enum(['info', 'error']),
  }),
]);
export type AgentEntry = z.infer<typeof AgentEntry>;

/** The session as the page reads it, whole: small enough to send on every change. */
export const AgentSession = z.object({
  mode: AgentMode,
  status: AgentStatus,
  sessionId: z.string().nullable(),
  /** What the person should know about the session's state, when the status alone does not say it. */
  hint: z.string().nullable(),
  entries: z.array(AgentEntry),
});
export type AgentSession = z.infer<typeof AgentSession>;
