// The contracts an agent reads, by the name they ship under. Add a line here
// when a skill needs a new one; what a schema is built from is inlined, so
// only the shapes an agent writes or reads back belong in the list.
import type { z } from 'zod';
import { ChangeSchema, CreateChangeSchema } from '#backend/app/changes/change';
import { DesignDocumentSchema } from '#backend/app/design-docs/design-doc';
import {
  CreateDocumentSchema,
  DocumentSchema,
} from '#backend/app/information-sources/document';
import { SystemModelSchema } from '#backend/app/system-model/system-model';
import designDocumentExample from './design-doc.example.json';

export const CONTRACTS = {
  change: { schema: ChangeSchema },
  'create-change': { schema: CreateChangeSchema },
  document: { schema: DocumentSchema },
  'create-document': { schema: CreateDocumentSchema },
  'design-document': {
    schema: DesignDocumentSchema,
    // Decoded, as every example is: the generator encodes it back to JSON,
    // with every default the file leaves out spelled out.
    example: DesignDocumentSchema.parse(designDocumentExample),
  },
  'system-model': { schema: SystemModelSchema },
} satisfies Record<string, { schema: z.ZodType; example?: unknown }>;
