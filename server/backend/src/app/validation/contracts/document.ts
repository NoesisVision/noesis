import {
  type Document,
  DocumentSchema,
} from '#backend/app/information-sources/model/document';
import type { FileContract } from '#backend/app/validation/validator';

/** One contract so the `validate` tool and the write path run the same checks (decision D4). */
export const documentContract: FileContract<Document> = {
  description:
    'A document of a change: its title, the date it was written or last revised, and its text.',
  schema: DocumentSchema,
};
