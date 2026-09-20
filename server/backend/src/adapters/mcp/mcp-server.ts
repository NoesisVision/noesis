import { randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { relative } from 'node:path';
import { withContext } from '@logtape/logtape';
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import {
  CallToolRequestSchema,
  type CallToolResult,
  ListToolsRequestSchema,
  type Tool,
} from '@modelcontextprotocol/sdk/types.js';
import { type ZodType, z } from 'zod';
import type { ScannerService } from '#backend/adapters/scanner/scanner.service';
import {
  ChangeSlug,
  InvalidChangeSlugError,
} from '#backend/app/changes/change-slug';
import type { ChangesService } from '#backend/app/changes/changes.service';
import { ChangeNotFoundError } from '#backend/app/changes/changes.service';
import {
  DesignDocNotFoundError,
  type DesignDocsService,
} from '#backend/app/design-docs/design-docs.service';
import type { DesignDocument } from '#backend/app/design-docs/model/design-doc';
import type { SearchService } from '#backend/app/search/search.service';
import { designDocumentContract } from '#backend/app/validation/contracts/design-document';
import {
  formatReport,
  singleIssue,
  type ValidationIssue,
  validate,
} from '#backend/app/validation/validator';
import type { SessionDir } from '#backend/platform/files/session-dir';

export interface McpDeps {
  repositoryRoot: string;
  session: SessionDir;
  changesService: ChangesService;
  designDocsService: DesignDocsService;
  searchService: SearchService;
  scannerService: ScannerService;
}

interface ToolDefinition<A> {
  description: string;
  args: ZodType<A>;
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

const changeSlug = z
  .string()
  .min(1)
  .describe(
    'The change the result belongs to: the slug of a directory under .noesis/graph/changes/.',
  );

// Arguments are validated here, not by the SDK (decision D3): the SDK rejects
// with a protocol-level InvalidParams error, while the MCP spec wants tool
// failures in-band (`isError`) so the model can correct itself.
export function createMcpServer(deps: McpDeps): Server {
  const { session, repositoryRoot } = deps;
  const rel = (path: string) => relative(repositoryRoot, path);

  async function readWorkingJson(
    input: string,
  ): Promise<{ ok: true; raw: unknown } | { ok: false; text: string }> {
    const resolved = await session.resolveWorkingPath(input);
    if (!resolved.ok) return { ok: false, text: resolved.message };
    const source = await readFile(resolved.path, 'utf8');
    try {
      return { ok: true, raw: JSON.parse(source) };
    } catch (error) {
      return {
        ok: false,
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

  const rejected = async (
    contract: string,
    issues: readonly ValidationIssue[],
    suppressed: number,
  ): Promise<CallToolResult> =>
    errorResult(
      await session.deliver(
        formatReport(contract, { ok: false, issues: [...issues], suppressed }),
      ),
    );

  /** Validated before a service sees it (decision D4). */
  async function readDesignDocument(
    path: string,
  ): Promise<
    { ok: true; value: DesignDocument } | { ok: false; result: CallToolResult }
  > {
    const file = await readWorkingJson(path);
    if (!file.ok) return { ok: false, result: errorResult(file.text) };
    const report = validate(designDocumentContract, file.raw);
    if (!report.ok) {
      return {
        ok: false,
        result: await rejected(
          'design-document',
          report.issues,
          report.suppressed,
        ),
      };
    }
    return { ok: true, value: report.value };
  }

  const changeMissing = async (
    error: ChangeNotFoundError | InvalidChangeSlugError,
  ): Promise<CallToolResult> => {
    const existing = (await deps.changesService.list()).map((c) => c.slug);
    return errorResult(
      `${error.message} Existing changes: ${existing.length > 0 ? existing.join(', ') : 'none'}. Create the change first.`,
    );
  };

  async function attempt(
    run: () => Promise<CallToolResult>,
  ): Promise<CallToolResult> {
    try {
      return await run();
    } catch (error) {
      if (
        error instanceof ChangeNotFoundError ||
        error instanceof InvalidChangeSlugError
      ) {
        return changeMissing(error);
      }
      if (error instanceof DesignDocNotFoundError) {
        return errorResult(
          `${error.message} Call list-design-docs to see the ids the change has.`,
        );
      }
      throw error;
    }
  }

  const tools = {
    'list-changes': define({
      description:
        'Lists the changes of this repository: the directories under .noesis/graph/changes/. Imports and design documents belong to a change.',
      args: z.object({}),
      handler: async () => {
        const changes = await deps.changesService.list();
        return text(
          changes.length === 0
            ? 'No changes yet. Create one in the Noesis ui before importing or designing.'
            : `Changes: ${changes.map((c) => c.slug).join(', ')}.`,
        );
      },
    }),

    'list-design-docs': define({
      description:
        'Lists the design documents of a change with their ids and file paths. Read a document from its file; update it with update-design-doc.',
      args: z.object({ change: changeSlug }),
      handler: async ({ change }) =>
        attempt(async () => {
          const docs = await deps.designDocsService.list(
            ChangeSlug.parse(change),
          );
          if (docs.length === 0) {
            return text(`Change ${change} has no design documents yet.`);
          }
          return text(
            docs
              .map(
                (d) =>
                  `${d.id}  ${d.name}  (${d.status}, ${d.date})  ${rel(d.path)}`,
              )
              .join('\n'),
          );
        }),
    }),

    'create-design-doc': define({
      description:
        'Creates a design document in a change from a working file that satisfies the design-document contract. An invalid file is rejected with an actionable issue list (path, expected versus found, one-line fix) and nothing is written; correct the file and call again.',
      args: z.object({ change: changeSlug, path: workingPath }),
      handler: async ({ change, path }) => {
        const document = await readDesignDocument(path);
        if (!document.ok) return document.result;
        return attempt(async () => {
          const summary = await deps.designDocsService.create(
            ChangeSlug.parse(change),
            document.value,
          );
          return text(
            `Created design document "${summary.name}" (${summary.id}) at ${rel(summary.path)}. The graph picks it up on the next re-index.`,
          );
        });
      },
    }),

    'update-design-doc': define({
      description:
        'Replaces a design document of a change with the working file, whole; the id stays. Read the current document from its file first and keep human-authored text as it is. An invalid file is rejected with an actionable issue list and nothing is written.',
      args: z.object({
        change: changeSlug,
        id: z.string().min(1).describe('The id of the document to replace.'),
        path: workingPath,
      }),
      handler: async ({ change, id, path }) => {
        const document = await readDesignDocument(path);
        if (!document.ok) return document.result;
        return attempt(async () => {
          const summary = await deps.designDocsService.update(
            ChangeSlug.parse(change),
            id,
            document.value,
          );
          return text(
            `Updated design document "${summary.name}" (${summary.id}) at ${rel(summary.path)}.`,
          );
        });
      },
    }),

    'scan-system-model': define({
      description:
        'Scans the repository source code and writes the implemented model to .noesis/graph/system-model/, one object per package: bounded contexts, modules, exported classes as building blocks and their public methods as behaviours, each with its source location. Run it before designing against existing code, or when the system model is missing or stale.',
      args: z.object({}),
      handler: async () => {
        const report = await deps.scannerService.scan();
        const lines = report.units.map(
          (u) =>
            `${u.name}  ${u.buildingBlocks} building block(s)  ${rel(u.path)}`,
        );
        if (report.removed.length > 0) {
          lines.push(`Removed stale: ${report.removed.join(', ')}.`);
        }
        return text(
          lines.length === 0
            ? 'No TypeScript units found (no package.json with .ts sources under the repository root).'
            : `Scanned ${report.units.length} unit(s) in ${report.durationMs} ms.\n${lines.join('\n')}`,
        );
      },
    }),

    'search-knowledge-graph': define({
      description:
        'Searches the knowledge graph — design documents, the system model and imported documents — by a case-insensitive substring of their titles and summaries. Returns ids to read the files by.',
      args: z.object({
        query: z.string().min(1).describe('What to look for.'),
      }),
      handler: async ({ query }) => {
        const results = await deps.searchService.search(query);
        if (results.length === 0) return text(`Nothing matches "${query}".`);
        return text(
          await session.deliver(
            results
              .map(
                (r) =>
                  `${r.type}  ${r.id}  ${r.title}${r.subtitle ? `  — ${r.subtitle}` : ''}`,
              )
              .join('\n'),
          ),
        );
      },
    }),
  } satisfies Record<string, ToolDefinition<unknown>>;

  const server = new Server(
    { name: 'noesis', version: '0.1.0' },
    {
      capabilities: { tools: {} },
      instructions: [
        `Noesis serves the repository at ${repositoryRoot}.`,
        `Knowledge graph files live under ${repositoryRoot}/.noesis/ and are committed with the code; read them directly.`,
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

    return withContext(
      { requestId: randomUUID(), tool: request.params.name },
      () => tool.handler(parsed.data),
    );
  });

  return server;
}

/** Keeps each tool's handler typed to its own arguments while the table holds them as `unknown`. */
function define<A>(tool: ToolDefinition<A>): ToolDefinition<unknown> {
  return tool as ToolDefinition<unknown>;
}
