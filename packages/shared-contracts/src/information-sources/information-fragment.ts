import { z } from 'zod';
import {
  type ConversationFragmentRef,
  ConversationFragmentRefSchema,
} from './conversation.js';
import {
  type DocumentFragmentRef,
  DocumentFragmentRefSchema,
} from './document.js';

// A reference to a single information fragment in any source — a fragment of a
// conversation or of a document. Topics and decisions point at their supporting
// content through these refs, source-agnostically.
export const InformationFragmentRefSchema = z
  .union([ConversationFragmentRefSchema, DocumentFragmentRefSchema])
  .describe(
    'A pointer to one fragment of an imported source; `type` says which kind.',
  );
export type InformationFragmentRef =
  | ConversationFragmentRef
  | DocumentFragmentRef;
