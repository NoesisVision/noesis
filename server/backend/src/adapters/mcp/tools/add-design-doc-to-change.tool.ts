import type { CallToolResult } from '@modelcontextprotocol/server';
import { z } from 'zod';
import type { ChangeSlug } from '#backend/app/changes/change-slug';
import { CreateDesignDocumentSchema } from '#backend/app/design-docs/design-doc';
import type {
  DesignDocSummary,
  DesignDocsService,
} from '#backend/app/design-docs/design-docs.service';
import { formatReport } from '#backend/app/validation/validator';
import type { SessionDir } from '#backend/platform/files/session-dir';
import { APPEND, defineTool, type ToolRegistration } from '../tool';
import { ADD_DESIGN_DOC_TO_CHANGE } from '../tool-names';
import { failure, success } from '../tool-result';
import { readWorkingFile } from '../working-file';
import { addToChangeInput, withChange } from './change-scoped';

const SUBJECT = 'design document';

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

export function addDesignDocToChangeTool(
  designDocs: DesignDocsService,
  session: SessionDir,
): ToolRegistration {
  return defineTool(
    ADD_DESIGN_DOC_TO_CHANGE,
    {
      title: 'Add design document to change',
      description:
        'Adds a design document to a change: a diff against the scanned model — the modules, building blocks and behaviours the change adds, modifies or removes, each named by the id the scanner gives it. Write the design document to a JSON working file under the session scratch directory and pass its path.',
      inputSchema: addToChangeInput(
        session,
        SUBJECT,
        '{ "name", "description", "modules", "buildingBlocks", "behaviours" }, each field a { "value", "reviewedByHuman" } pair and each collection a change set of { "added", "removed", "modified" }. Leave out "id"; the server mints it.',
      ),
      outputSchema,
      annotations: APPEND,
    },
    (input) =>
      withChange(input.change, SUBJECT, (slug) =>
        add(designDocs, session, slug, input.path),
      ),
  );
}

async function add(
  designDocs: DesignDocsService,
  session: SessionDir,
  slug: ChangeSlug,
  path: string,
): Promise<CallToolResult> {
  const report = await readWorkingFile(
    session,
    { schema: CreateDesignDocumentSchema },
    path,
  );
  if (!report.ok) return failure(formatReport(SUBJECT, report));

  // The service takes the JSON form, so the checked document is encoded back
  // rather than the raw file passed on: defaults come out spelled in full.
  const document = z.encode(CreateDesignDocumentSchema, report.value);
  return added(slug, await designDocs.create(slug, document));
}

function added(slug: ChangeSlug, summary: DesignDocSummary): CallToolResult {
  return success(
    `Added design document "${summary.name}" to ${slug.value} as ${summary.id}, stored at ${summary.path}.`,
    { ...summary },
  );
}
