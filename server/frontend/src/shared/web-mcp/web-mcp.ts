import { z } from 'zod';
import { uiLogger } from '#/shared/logging.ts';

/*
 * WebMCP: a page offers tools to an agent in the browser through
 * `document.modelContext` (`navigator.modelContext` before Chrome 150). The
 * draft still moves, so this file is the one place that knows its shape; a
 * browser without it is offered nothing, and nothing fails.
 *
 * A tool takes its input as a Zod schema, handed to the agent as JSON
 * Schema and checked before the tool runs; what it gives back is handed
 * over as text, JSON unless it is text already.
 */

/** A tool as the page writes it. */
export interface WebTool<Input extends z.ZodType = z.ZodType> {
  /** What the agent calls it: snake_case, `[A-Za-z0-9_.-]`. */
  name: string;
  /** What it does and when to use it, for the agent to choose by. */
  description: string;
  input: Input;
  /** It reads the page and changes nothing. */
  readOnly?: boolean;
  run: (input: z.infer<Input>) => unknown;
}

/** A tool, typed by its own input; only an identity, for inference. */
export const webTool = <Input extends z.ZodType>(
  tool: WebTool<Input>,
): WebTool => tool as unknown as WebTool;

/** A tool's refusal, given to the agent as an error rather than thrown at it. */
export class ToolRefusal extends Error {}

/** What the draft calls a tool, as far as we hand it over. */
interface ModelContextTool {
  name: string;
  description: string;
  inputSchema: object;
  annotations?: { readOnlyHint?: boolean };
  execute: (input: unknown) => Promise<string>;
}

export interface ModelContext {
  registerTool: (
    tool: ModelContextTool,
    options?: { signal?: AbortSignal },
  ) => unknown;
}

/** The browser's model context, or none where WebMCP is not there. */
function modelContextOf(): ModelContext | null {
  if (typeof document === 'undefined') return null;
  const holders = [document, globalThis.navigator] as unknown as (
    | {
        modelContext?: ModelContext;
      }
    | undefined
  )[];
  for (const holder of holders) {
    const context = holder?.modelContext;
    if (typeof context?.registerTool === 'function') return context;
  }
  return null;
}

const log = uiLogger('web-mcp');

/** The input schema as the agent reads it, without the dialect line. */
function inputSchemaOf(input: z.ZodType): object {
  const { $schema: _, ...schema } = z.toJSONSchema(input, { io: 'input' });
  return schema;
}

const textOf = (result: unknown): string =>
  typeof result === 'string' ? result : JSON.stringify(result);

/** What the agent is told when a tool cannot do what it asked. */
const refusalOf = (message: string) => JSON.stringify({ error: message });

function toModelTool(tool: WebTool): ModelContextTool {
  return {
    name: tool.name,
    description: tool.description,
    inputSchema: inputSchemaOf(tool.input),
    annotations: { readOnlyHint: tool.readOnly === true },
    execute: async (given) => {
      // An older draft handed the input over as JSON text.
      const raw = typeof given === 'string' ? JSON.parse(given) : given;
      const input = tool.input.safeParse(raw ?? {});
      if (!input.success) return refusalOf(z.prettifyError(input.error));
      try {
        return textOf(await tool.run(input.data));
      } catch (error) {
        if (error instanceof ToolRefusal) return refusalOf(error.message);
        log.error('tool {name} failed: {error}', { name: tool.name, error });
        throw error;
      }
    },
  };
}

/**
 * Offers the tools to an agent until the returned function takes them back;
 * offers nothing where the browser has no model context.
 */
export function registerTools(
  tools: readonly WebTool[],
  context: ModelContext | null = modelContextOf(),
): () => void {
  if (context === null) return () => {};
  const offered = new AbortController();
  const { signal } = offered;
  // Taken back before the browser was done registering it — React's strict
  // mode takes every effect back once at mount — a tool is not lost: it is
  // offered again by whoever takes it back, so only a real failure is told.
  const failed = (name: string) => (error: unknown) => {
    if (signal.aborted) return;
    log.warn('tool {name} could not be offered: {error}', { name, error });
  };
  for (const tool of tools)
    try {
      void Promise.resolve(context.registerTool(toModelTool(tool), { signal }))
        .then(() => {
          if (signal.aborted) return;
          offer(tool.name, 1);
          signal.addEventListener('abort', () => offer(tool.name, -1));
        })
        .catch(failed(tool.name));
    } catch (error) {
      failed(tool.name)(error);
    }
  return () => offered.abort();
}

/**
 * How many times each tool is offered now, the browser done registering it;
 * more than once while a view is mounted twice, as strict mode does.
 */
const offeredNow = new Map<string, number>();
const watching = new Set<() => void>();

function offer(name: string, by: 1 | -1) {
  const count = (offeredNow.get(name) ?? 0) + by;
  if (count > 0) offeredNow.set(name, count);
  else offeredNow.delete(name);
  for (const look of watching) look();
}

/**
 * Whether a tool of this page is offered, once it is or once `ms` have gone
 * by without it; at once if it is offered already.
 */
export function whenOffered(name: string, ms: number): Promise<boolean> {
  return new Promise((resolve) => {
    const done = (offered: boolean) => {
      clearTimeout(timer);
      watching.delete(look);
      resolve(offered);
    };
    const look = () => {
      if (offeredNow.has(name)) done(true);
    };
    const timer = setTimeout(() => done(false), ms);
    watching.add(look);
    look();
  });
}
