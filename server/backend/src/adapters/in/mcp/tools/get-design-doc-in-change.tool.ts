import type { CallToolResult } from '@modelcontextprotocol/server';
import { z } from 'zod';
import {
  type SessionFiles,
  WorkingFileName,
} from '#backend/adapters/in/mcp/session-files';
import { ChangeId } from '#backend/app/changes/change-id';
import {
  DesignDocument,
  DesignDocumentContent,
} from '#backend/app/design-docs/design-doc';
import { DesignDocId } from '#backend/app/design-docs/design-doc-id';
import type { FindDesignDocHandler } from '#backend/app/design-docs/find-design-doc';
import { defineTool, READ_ONLY, type ToolRegistration } from '../tool';
import {
  GET_DESIGN_DOC_IN_CHANGE,
  LIST_CHANGES,
  LIST_DESIGN_DOCS_IN_CHANGE,
  UPDATE_DESIGN_DOC_IN_CHANGE,
} from '../tool-names';
import { success } from '../tool-result';

const outputSchema = z
  .object({
    designDoc: DesignDocument.optional().describe(
      'The design document as stored now, whole: every field with its author, the edits a human made in the Noesis page included. Absent when it was written to a working file.',
    ),
    workingFile: z
      .string()
      .optional()
      .describe(
        'The absolute path of the working file the design document was written to, when one was asked for.',
      ),
  })
  .describe('The design document, inline or as a working file.');

export function getDesignDocInChangeTool(
  findDesignDoc: FindDesignDocHandler,
  files: SessionFiles,
): ToolRegistration {
  return defineTool(
    GET_DESIGN_DOC_IN_CHANGE,
    {
      title: 'Get design document in change',
      description: `Answers with one design document of a change, whole and as stored now: its name, description, needs, modules, building blocks and behaviours, each field with its author. Find the id with ${LIST_DESIGN_DOCS_IN_CHANGE}. To revise it, name a "workingFile": the design document is written there as the working file ${UPDATE_DESIGN_DOC_IN_CHANGE} reads, without "id" and "implementedAt", and only its path comes back.`,
      inputSchema: inputSchema(files),
      outputSchema,
      annotations: READ_ONLY,
    },
    async ({ change, id, workingFile }) => {
      const designDoc = await findDesignDoc.handle({ change, id });
      if (workingFile === undefined) return inline(change, designDoc);
      return written(
        change,
        designDoc,
        files.write(workingFile, DesignDocumentContent, contentOf(designDoc)),
      );
    },
  );
}

function inputSchema(files: SessionFiles) {
  return z
    .object({
      change: ChangeId.describe(
        `The id of the change the design document belongs to, as ${LIST_CHANGES} lists it, e.g. "2026-09-24-payment-retry".`,
      ),
      id: DesignDocId.describe(
        `The id of the design document, as ${LIST_DESIGN_DOCS_IN_CHANGE} lists it.`,
      ),
      workingFile: WorkingFileName.optional().describe(
        `A file name, e.g. "design-doc.json", to write the design document to as a working file in this session's scratch directory, ${files.dir}, replacing a file of that name. Left out, the design document comes back inline.`,
      ),
    })
    .describe(
      'The design document to read, the change it is in, and where to write it.',
    );
}

function inline(change: ChangeId, designDoc: DesignDocument): CallToolResult {
  return success(`${label(change, designDoc)}.`, { designDoc });
}

function written(
  change: ChangeId,
  designDoc: DesignDocument,
  workingFile: string,
): CallToolResult {
  return success(
    `${label(change, designDoc)}, written to ${workingFile}. Edit it there and pass its path to ${UPDATE_DESIGN_DOC_IN_CHANGE} with the id ${designDoc.id}.`,
    { workingFile },
  );
}

function contentOf({
  id: _id,
  implementedAt: _implementedAt,
  ...content
}: DesignDocument): DesignDocumentContent {
  return content;
}

function label(change: ChangeId, designDoc: DesignDocument): string {
  const implemented = designDoc.implemented ? ', implemented' : '';
  return `Design document ${designDoc.id} ("${designDoc.name}"${implemented}) in ${change}`;
}
