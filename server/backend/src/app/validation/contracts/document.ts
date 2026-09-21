import {
  type CreateDocument,
  CreateDocumentSchema,
} from '#backend/app/information-sources/model/document';
import { DocumentId } from '#backend/app/information-sources/model/document-id';
import type { FileContract } from '#backend/app/validation/validator';

/**
 * One rule beyond the shape: the id is the title as a slug, so a title the
 * slug empties — punctuation, or a script with no ASCII in it — would land on
 * the one fallback id, where the next such title looks like a duplicate of
 * the first. The schema cannot say that declaratively (decision D4 keeps the
 * contracts free of `refine`), so it is checked here, where the MCP tool
 * reads the working file and owes the agent the report `validate` produces
 * (decision D3).
 */
export const documentContract: FileContract<CreateDocument> = {
  description:
    'A document of a change: its title, the date it was written, and its text.',
  schema: CreateDocumentSchema,
  check: (document) =>
    DocumentId.tryFromTitle(document.title) !== null
      ? []
      : [
          {
            path: '$.title',
            expected: 'a title with a letter or a digit in it',
            found: JSON.stringify(document.title),
            fix: 'Retitle the document so an id can be derived from it',
          },
        ],
};
