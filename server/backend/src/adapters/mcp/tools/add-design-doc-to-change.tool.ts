import type { CallToolResult } from '@modelcontextprotocol/server';
import type { ChangeSlug } from '#backend/app/changes/change-slug';
import { CreateDesignDocument } from '#backend/app/design-docs/design-doc';
import {
  type DesignDocSummary,
  DesignDocSummarySchema,
  type DesignDocsService,
} from '#backend/app/design-docs/design-docs.service';
import { formatReport } from '#backend/app/validation/validator';
import type { SessionDir } from '#backend/platform/files/session-dir';
import { APPEND, defineTool, type ToolRegistration } from '../tool';
import { ADD_DESIGN_DOC_TO_CHANGE } from '../tool-names';
import { failure, success } from '../tool-result';
import { readWorkingFile } from '../working-file';
import { addToChangeInput, withChange } from './change-scoped';

const SUBJECT = 'design document';

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
        '{ "name", "description", "modules", "buildingBlocks", "behaviours" }. A field is { "value", "author" } when the design changes it, { "changed": false } or absent when it does not; each collection is a change set of { "added", "removed", "modified" }. Leave out "id"; the server mints it.',
      ),
      outputSchema: DesignDocSummarySchema.describe(
        'Where the design document now lives.',
      ),
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
  const document = await readWorkingFile(session, CreateDesignDocument, path);
  if (document.isErr()) {
    return failure(formatReport(SUBJECT, document.error));
  }
  return added(slug, await designDocs.create(slug, document.value));
}

function added(slug: ChangeSlug, summary: DesignDocSummary): CallToolResult {
  return success(
    `Added design document "${summary.name}" to ${slug} as ${summary.id}, stored at ${summary.path}.`,
    summary,
  );
}
