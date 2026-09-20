import {
  type CreateDocument,
  CreateDocumentSchema,
} from '#backend/app/information-sources/model/document';
import type { FileContract } from '#backend/app/validation/validator';

/**
 * Schema only: a document has no whole-document rule beyond its shape. It is
 * a contract rather than a bare schema because the MCP tool reads it from a
 * working file and owes the agent the actionable report `validate` produces
 * (decision D3).
 */
export const documentContract: FileContract<CreateDocument> = {
  description:
    'A document of a change: its title, the date it was written, and its text.',
  schema: CreateDocumentSchema,
};
