// GENERATED from @repo/mcp-contracts — do not edit; run `bun run generate`.
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
export const InformationFragmentRefSchema = z.union([
  ConversationFragmentRefSchema,
  DocumentFragmentRefSchema,
]);
export type InformationFragmentRef =
  | ConversationFragmentRef
  | DocumentFragmentRef;
