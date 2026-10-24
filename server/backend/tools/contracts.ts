// The contracts an agent reads, by the name they ship under. Add a line here
// when a skill needs a new one; what a schema is built from is inlined, so
// only the shapes an agent writes or reads back belong in the list. Each is
// a whole working file, never with an id: the server mints it on create, and
// an update names it beside the file.
import type { z } from 'zod';
import {
  ChangeContentSchema,
  NewChangeSchema,
} from '#backend/app/changes/change';
import { DesignDocumentContent } from '#backend/app/design-docs/design-doc';
import { DocumentContentSchema } from '#backend/app/information-sources/document';
import { SystemModel } from '#backend/app/system-model/system-model';
import designDocumentExample from './design-doc.example.json';

export const CONTRACTS = {
  'new-change': { schema: NewChangeSchema },
  change: { schema: ChangeContentSchema },
  document: { schema: DocumentContentSchema },
  'design-document': {
    schema: DesignDocumentContent,
    // Decoded, as every example is: the generator encodes it back to JSON,
    // with every default the file leaves out spelled out.
    example: DesignDocumentContent.parse(designDocumentExample),
  },
  'system-model': { schema: SystemModel },
} satisfies Record<string, { schema: z.ZodType; example?: unknown }>;
