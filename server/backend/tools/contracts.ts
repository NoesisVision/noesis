// The contracts an agent reads, by the name they ship under. Add a line here
// when a skill needs a new one; what a schema is built from is inlined, so
// only the shapes an agent writes or reads back belong in the list.
import type { z } from 'zod';
import {
  ChangeSchema,
  CreateChangeSchema,
} from '#backend/app/changes/model/change';
import { DesignDocumentSchema } from '#backend/app/design-docs/model/design-doc';
import { designDocFixture } from '#backend/app/design-docs/model/design-doc.fixture';
import {
  CreateDocumentSchema,
  DocumentSchema,
} from '#backend/app/information-sources/model/document';
import { SystemModelSchema } from '#backend/app/system-model/model/system-model';

export const CONTRACTS = {
  change: { schema: ChangeSchema },
  'create-change': { schema: CreateChangeSchema },
  document: { schema: DocumentSchema },
  'create-document': { schema: CreateDocumentSchema },
  'design-document': {
    schema: DesignDocumentSchema,
    example: designDocFixture,
  },
  'system-model': { schema: SystemModelSchema },
} satisfies Record<string, { schema: z.ZodType; example?: unknown }>;
