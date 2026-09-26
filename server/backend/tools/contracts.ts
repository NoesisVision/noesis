// The contracts an agent reads, by the name they ship under. Add a line here
// when a skill needs a new one; what a schema is built from is inlined, so
// only the shapes an agent writes or reads back belong in the list. Each is
// a whole working file, never with an id: the server mints it on create, and
// an update names it beside the file.
import type { z } from 'zod';
import {
  CreateChange,
  UpdateChange,
} from '#backend/app/changes/model/change-snapshot';
import {
  CreateDesignDoc,
  UpdateDesignDoc,
} from '#backend/app/changes/model/design-doc';
import {
  CreateSourceDocument,
  UpdateSourceDocument,
} from '#backend/app/changes/model/source-document';
import { SystemModel } from '#backend/app/system-model/system-model';
import designDocExample from './design-doc.example.json';

export const CONTRACTS = {
  'create-change': { schema: CreateChange },
  'update-change': { schema: UpdateChange },
  'create-source-document': { schema: CreateSourceDocument },
  'update-source-document': { schema: UpdateSourceDocument },
  // Decoded, as every example is: the generator encodes it back to JSON,
  // with every default the file leaves out spelled out.
  'create-design-doc': {
    schema: CreateDesignDoc,
    example: CreateDesignDoc.parse(designDocExample),
  },
  'update-design-doc': {
    schema: UpdateDesignDoc,
    example: UpdateDesignDoc.parse(designDocExample),
  },
  'system-model': { schema: SystemModel },
} satisfies Record<string, { schema: z.ZodType; example?: unknown }>;
