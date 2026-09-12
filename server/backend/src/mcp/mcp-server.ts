import { readFile } from 'node:fs/promises';
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import {
  CallToolRequestSchema,
  type CallToolResult,
  ListToolsRequestSchema,
  type Tool,
} from '@modelcontextprotocol/sdk/types.js';
import { type ZodType, z } from 'zod';
import type { ChangesService } from '../changes/changes.service.js';
import { ChangeNotFoundError } from '../changes/changes.service.js';
import {
  type DesignDocsService,
  InvalidDesignDocumentError,
} from '../design-docs/design-docs.service.js';
import type { SessionDir } from '../files/session-dir.js';
import {
  formatReport,
  singleIssue,
  validate,
} from '../validation/validator.js';
import { contractNames, contracts } from './contracts/index.js';

/**
 * What the tools may touch: the same services the HTTP surface gets, handed in
 * by the composition root. Tools call them directly — there is no REST hop
 * between the agent's process and the services (decision 68).
 */
export interface McpDeps {
  /** The repository root, stated in the server's `instructions`. */
  repositoryRoot: string;
  /** This process's scratch directory; working files come and go through it. */
  session: SessionDir;
  changesService: ChangesService;
  designDocsService: DesignDocsService;
}

interface ToolDefinition<A> {
  description: string;
  /** Validates the arguments and is advertised as the tool's JSON Schema. */
  args: ZodType<A>;
  /** Receives arguments already validated against `args`. */
  handler: (args: A) => Promise<CallToolResult>;
}

const text = (value: string): CallToolResult => ({
  content: [{ type: 'text', text: value }],
});

const errorResult = (value: string): CallToolResult => ({
  isError: true,
  content: [{ type: 'text', text: value }],
});

const workingPath = z
  .string()
  .min(1)
  .describe(
    'A working file under .noesis/tmp/, absolute or relative to the repository root.',
  );

/**
 * Builds the MCP server and registers its tools; transport wiring stays in
 * main.ts. Tools are thin — parse arguments, call one service method, shape
 * the response. Payloads never travel inline: a tool takes the path of a
 * working file the agent wrote under `.noesis/tmp/`, and a result too large to
 * return inline is written there and handed back as a path.
 *
 * Validation is owned here, not by the SDK (decision 34): the SDK's built-in
 * input validation rejects bad payloads with a protocol-level InvalidParams
 * error, while the MCP spec wants tool-level failures in-band (`isError`) so
 * the calling model can read the problem and correct itself.
 */
export function createMcpServer(deps: McpDeps): Server {
  const { session } = deps;

  /** Reads and parses the working file an argument names; every failure is a message for the model. */
  async function readWorkingJson(
    input: string,
  ): Promise<
    { ok: true; raw: unknown } | { ok: false; text: string; report: boolean }
  > {
    const resolved = await session.resolveWorkingPath(input);
    if (!resolved.ok)
      return { ok: false, text: resolved.message, report: false };
    const source = await readFile(resolved.path, 'utf8');
    try {
      return { ok: true, raw: JSON.parse(source) };
    } catch (error) {
      return {
        ok: false,
        report: true,
        text: formatReport(
          'JSON',
          singleIssue({
            path: '$',
            expected: 'a valid JSON document',
            found: (error as Error).message,
            fix: `Fix the JSON syntax in ${resolved.path}`,
          }),
        ),
      };
    }
  }

  const tools = {
    validate: define({
      description:
        'Validates a working file against a Noesis contract and returns an actionable issue list (path, expected versus found, one-line fix). Run it until the file is clean before calling the tool that consumes it.',
      args: z.object({
        contract: z
          .enum(contractNames)
          .describe('The contract the file must satisfy.'),
        path: workingPath,
      }),
      handler: async ({ contract, path }) => {
        const file = await readWorkingJson(path);
        if (!file.ok) {
          return file.report ? text(file.text) : errorResult(file.text);
        }
        const report = validate(contracts[contract], file.raw);
        return text(await session.deliver(formatReport(contract, report)));
      },
    }),

    'create-design-doc': define({
      description:
        'Creates a design document in a change from a working file that satisfies the design-document contract. The service validates the file again and rejects it with the same issue list the validate tool gives.',
      args: z.object({
        change: z
          .string()
          .min(1)
          .describe(
            'The change the document belongs to: the slug of a directory under .noesis/changes/.',
          ),
        path: workingPath,
      }),
      handler: async ({ change, path }) => {
        const file = await readWorkingJson(path);
        if (!file.ok) return errorResult(file.text);
        try {
          const summary = await deps.designDocsService.create(change, file.raw);
          return text(
            `Created design document "${summary.name}" (${summary.id}) in change ${change}. The graph picks it up on the next re-index.`,
          );
        } catch (error) {
          if (error instanceof InvalidDesignDocumentError) {
            return errorResult(
              await session.deliver(
                formatReport('design-document', {
                  ok: false,
                  issues: [...error.issues],
                  suppressed: error.suppressed,
                }),
              ),
            );
          }
          if (error instanceof ChangeNotFoundError) {
            const existing = (await deps.changesService.list()).map(
              (c) => c.slug,
            );
            return errorResult(
              `${error.message} Existing changes: ${existing.length > 0 ? existing.join(', ') : 'none'}. Create the change first.`,
            );
          }
          throw error;
        }
      },
    }),
  } satisfies Record<string, ToolDefinition<unknown>>;

  const server = new Server(
    { name: 'noesis', version: '0.1.0' },
    {
      capabilities: { tools: {} },
      instructions: [
        `Noesis serves the repository at ${deps.repositoryRoot}.`,
        `Knowledge graph files live under ${deps.repositoryRoot}/.noesis/ and are committed with the code.`,
        `This session's scratch directory is ${session.path} — write working files there directly (no tool call needed) and pass their paths to the tools. It is deleted when the session ends.`,
      ].join('\n'),
    },
  );

  server.setRequestHandler(ListToolsRequestSchema, () => ({
    tools: Object.entries(tools).map(([name, tool]) => ({
      name,
      description: tool.description,
      inputSchema: z.toJSONSchema(tool.args) as Tool['inputSchema'],
    })),
  }));

  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const tool: ToolDefinition<unknown> | undefined =
      tools[request.params.name as keyof typeof tools];
    if (!tool) {
      return errorResult(
        `Unknown tool "${request.params.name}". Available tools: ${Object.keys(tools).join(', ')}.`,
      );
    }

    const parsed = tool.args.safeParse(request.params.arguments ?? {});
    if (!parsed.success) {
      return errorResult(
        [
          `Invalid arguments for tool "${request.params.name}":`,
          z.prettifyError(parsed.error),
          'Correct the arguments and call the tool again.',
        ].join('\n\n'),
      );
    }

    return tool.handler(parsed.data);
  });

  return server;
}

/** Keeps each tool's handler typed to its own arguments while the table holds them as `unknown`. */
function define<A>(tool: ToolDefinition<A>): ToolDefinition<unknown> {
  return tool as ToolDefinition<unknown>;
}
