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
import type { SearchService } from '#backend/app/search/search.service';
import {
  contractNames,
  contracts,
  designDocumentContract,
} from '#backend/app/validation/contracts';
import {
  type FileContract,
  formatReport,
  singleIssue,
  type ValidationIssue,
  validate,
} from '#backend/app/validation/validator';
import type { SessionDir } from '#backend/platform/files/session-dir';
import type { DesignDocument } from '#backend/shared/contracts';
import {
  DuplicateSourceError,
  type ImportReport,
  type ImportService,
  InvalidImportError,
} from './import.service';

/**
 * What the tools may touch: the same services the HTTP surface gets, handed in
 * by the composition root. Tools call them directly — there is no REST hop
 * between the agent's process and the services (decision D3).
 */
export interface McpDeps {
  /** The repository root, stated in the server's `instructions`. */
  repositoryRoot: string;
  /** This process's scratch directory; working files come and go through it. */
  session: SessionDir;
  changesService: ChangesService;
  designDocsService: DesignDocsService;
  importService: ImportService;
  searchService: SearchService;
  scannerService: ScannerService;
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

const changeSlug = z
  .string()
  .min(1)
  .describe(
    'The change the result belongs to: the slug of a directory under .noesis/graph/changes/.',
  );

/**
 * Builds the MCP server and registers its tools; transport wiring stays in
 * main.ts. Tools are thin — parse arguments, call one service method, shape
 * the response. Payloads never travel inline: a tool takes the path of a
 * working file the agent wrote under `.noesis/tmp/`, and a result too large to
 * return inline is written there and handed back as a path.
 *
 * Validation is owned here, not by the SDK (decision D3): the SDK's built-in
 * input validation rejects bad payloads with a protocol-level InvalidParams
 * error, while the MCP spec wants tool-level failures in-band (`isError`) so
 * the calling model can read the problem and correct itself.
 */
export function createMcpServer(deps: McpDeps): Server {
  const { session, repositoryRoot } = deps;
  const rel = (path: string) => relative(repositoryRoot, path);

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

  /** The design-document boundary (decision D4): the working file must pass the contract before a service sees it. */
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

  /** Runs a write against a change, turning the known failures into in-band results. */
  async function attempt(
    run: () => Promise<CallToolResult>,
  ): Promise<CallToolResult> {
    try {
      return await run();
    } catch (error) {
      if (error instanceof InvalidImportError) {
        return rejected(error.contract, error.issues, error.suppressed);
      }
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
      if (error instanceof DuplicateSourceError) {
        return errorResult(
          `${error.message.replace(error.path, rel(error.path))} Nothing was written; the topics were not updated either. Import a different source, or edit the wiki files directly.`,
        );
      }
      throw error;
    }
  }

  const importReport = (report: ImportReport): string =>
    [
      `Imported the ${report.source.kind} as ${rel(report.source.path)} (id ${report.source.id}).`,
      `Topics created: ${listOrNone(report.topics.created)}. Topics updated: ${listOrNone(report.topics.updated)}.`,
      `Decisions created: ${listOrNone(report.decisions.created)}. Decisions updated: ${listOrNone(report.decisions.updated)}.`,
      'The graph picks the files up on the next re-index.',
    ].join('\n');

  /** An import tool: a working file the import service validates against its contract, imported into a change. */
  const importTool = (
    description: string,
    run: (change: ChangeSlug, payload: unknown) => Promise<ImportReport>,
  ) =>
    define({
      description,
      args: z.object({ change: changeSlug, path: workingPath }),
      handler: async ({ change, path }) => {
        const file = await readWorkingJson(path);
        if (!file.ok) return errorResult(file.text);
        return attempt(async () =>
          text(importReport(await run(ChangeSlug.parse(change), file.raw))),
        );
      },
    });

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
        // The registry is a union of typed contracts; the tool only reports.
        const fileContract: FileContract = contracts[contract];
        const report = validate(fileContract, file.raw);
        return text(await session.deliver(formatReport(contract, report)));
      },
    }),

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

    'import-conversation': importTool(
      'Imports a conversation from a working file that satisfies the conversation-analysis contract: writes the conversation under the change and creates or updates the wiki topics and decisions the analysis names. Locked fields of existing topics and decisions are kept.',
      (change, payload) =>
        deps.importService.importConversation(change, payload),
    ),

    'import-document': importTool(
      'Imports a document from a working file that satisfies the document-analysis contract: writes the document under the change and creates or updates the wiki topics and decisions the analysis names. Locked fields of existing topics and decisions are kept.',
      (change, payload) => deps.importService.importDocument(change, payload),
    ),

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
        'Creates a design document in a change from a working file that satisfies the design-document contract. The service validates the file again and rejects it with the same issue list the validate tool gives.',
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
        'Replaces a design document of a change with the working file, whole; the id stays. Read the current document from its file first and keep human-authored text as it is.',
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
        'Searches the knowledge graph — wiki topics and decisions, design documents, imported conversations and documents — by a case-insensitive substring of their titles and summaries. Returns ids to read the files by.',
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

    // The MCP counterpart of the HTTP request id: every log line the tool
    // writes carries which tool ran and a fresh id for the call.
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

const listOrNone = (ids: string[]): string =>
  ids.length === 0 ? 'none' : ids.join(', ');
