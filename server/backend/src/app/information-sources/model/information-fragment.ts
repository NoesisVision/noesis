import { z } from 'zod';
import {
  type ConversationFragmentRef,
  ConversationFragmentRefSchema,
} from './conversation';
import {
  type DocumentFragmentRef,
  DocumentFragmentRefSchema,
} from './document';

export const InformationFragmentRefSchema = z
  .union([ConversationFragmentRefSchema, DocumentFragmentRefSchema])
  .describe(
    'A pointer to one fragment of an imported source; `type` says which kind.',
  );
export type InformationFragmentRef =
  | ConversationFragmentRef
  | DocumentFragmentRef;
