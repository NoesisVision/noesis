import type { CallToolResult, McpServer } from '@modelcontextprotocol/server';
import { z } from 'zod';
import { ChangeSlug } from '#backend/app/changes/change-slug';
import { ChangeNotFoundError } from '#backend/app/changes/changes.service';
import { CreateDesignDocumentSchema } from '#backend/app/design-docs/design-doc';
import type {
  DesignDocSummary,
  DesignDocsService,
} from '#backend/app/design-docs/design-docs.service';
import { formatReport } from '#backend/app/validation/validator';
import type { SessionDir } from '#backend/platform/files/session-dir';
import { logged } from '../tool-handler';
import { failure, success } from '../tool-result';
import { readWorkingFile } from '../working-file';
import { CREATE_CHANGE } from './create-change.tool';

const ADD_DESIGN_DOC_TO_CHANGE = 'add_design_doc_to_change';

// As in add_document_to_change: the slug is a plain string answered in-band,
// and the scratch directory is named here because this description is served
// by the process that owns it.
const inputSchemaFor = (session: SessionDir) =>
  z
    .object({
      change: z
        .string()
        .describe(
          'The slug of the change the design document belongs to, as create_change returned it or list_changes lists it, e.g. "payment-retry".',
        ),
      path: z
        .string()
        .describe(
          `Path to a JSON working file holding the design document: { "name", "description", "modules", "buildingBlocks", "behaviours" }, each field a { "value", "reviewedByHuman" } pair and each collection a change set of { "added", "removed", "modified" }. Leave out "id"; the server mints it. Write it yourself into this session's scratch directory, ${session.path}, which is deleted when the session ends; any path under .noesis/tmp/ is accepted. The design never travels in this call.`,
        ),
    })
    .describe(
      'The change to add to, and where its design document is written.',
    );

type AddDesignDocInput = z.infer<ReturnType<typeof inputSchemaFor>>;

const outputSchema = z
  .object({
    id: z.string().describe('The design document id, minted by the server.'),
    name: z.string().describe('The design document name, as stored.'),
    implemented: z
      .boolean()
      .describe('Whether the design is marked as implemented.'),
    path: z
      .string()
      .describe(
        'Absolute path the design document was stored at under .noesis/.',
      ),
  })
  .describe('Where the design document now lives.');

export function registerAddDesignDocToChange(
  server: McpServer,
  designDocs: DesignDocsService,
  session: SessionDir,
): void {
  server.registerTool(
    ADD_DESIGN_DOC_TO_CHANGE,
    {
      title: 'Add design document to change',
      description:
        'Adds a design document to a change: a diff against the scanned model — the modules, building blocks and behaviours the change adds, modifies or removes, each named by the id the scanner gives it. Write the design document to a JSON working file under the session scratch directory and pass its path.',
      inputSchema: inputSchemaFor(session),
      outputSchema,
      annotations: {
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: false,
        openWorldHint: false,
      },
    },
    logged(ADD_DESIGN_DOC_TO_CHANGE, (input: AddDesignDocInput) =>
      add(designDocs, session, input),
    ),
  );
}

async function add(
  designDocs: DesignDocsService,
  session: SessionDir,
  input: AddDesignDocInput,
): Promise<CallToolResult> {
  const parsed = ChangeSlug.tryCreate(input.change);
  if (parsed.isErr()) return notASlug(input.change);
  const slug = parsed.value;

  const report = await readWorkingFile(
    session,
    { schema: CreateDesignDocumentSchema },
    input.path,
  );
  if (!report.ok) return failure(formatReport('design document', report));

  // The service takes the JSON form, so the checked document is encoded back
  // rather than the raw file passed on: defaults come out spelled in full.
  const document = z.encode(CreateDesignDocumentSchema, report.value);
  try {
    return added(slug, await designDocs.create(slug, document));
  } catch (error) {
    if (error instanceof ChangeNotFoundError) return noSuchChange(error);
    throw error;
  }
}

function added(slug: ChangeSlug, summary: DesignDocSummary): CallToolResult {
  return success(
    `Added design document "${summary.name}" to ${slug.value} as ${summary.id}, stored at ${summary.path}.`,
    { ...summary },
  );
}

function notASlug(value: string): CallToolResult {
  return failure(
    `${JSON.stringify(value)} is not a change slug.`,
    'A slug is lower-case kebab-case, as create_change returned it, e.g. "payment-retry".',
  );
}

function noSuchChange(error: ChangeNotFoundError): CallToolResult {
  return failure(
    error.message,
    `Create it with ${CREATE_CHANGE} first, then add the design document to the slug it returns.`,
  );
}
