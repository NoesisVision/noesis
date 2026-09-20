import {
  type Document,
  DocumentSchema,
} from '#backend/app/information-sources/model/document';
import type { FileContract } from '#backend/app/validation/validator';

/** One contract behind every write path — the MCP tools and the ui routes check the same way (decision D4). */
export const documentContract: FileContract<Document> = {
  description:
    'A document of a change: its title, the date it was written or last revised, and its text.',
  schema: DocumentSchema,
};
