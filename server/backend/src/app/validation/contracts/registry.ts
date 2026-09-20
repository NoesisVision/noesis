import { ChangeSchema } from '#backend/app/changes/model/change';
import { ConversationSchema } from '#backend/app/information-sources/model/conversation';
import { DocumentSchema } from '#backend/app/information-sources/model/document';
import { SystemModelSchema } from '#backend/app/system-model/model/system-model';
import type { FileContract } from '#backend/app/validation/validator';
import { designDocumentContract } from './design-document';

/**
 * A contract carries the service's write-time check where there is one, so
 * `validate` and a rejected write agree.
 */
export const contracts = {
  'design-document': designDocumentContract,
  change: {
    description: 'The data.json of a change under .noesis/graph/changes/.',
    schema: ChangeSchema,
  },
  conversation: {
    description: 'An imported conversation file.',
    schema: ConversationSchema,
  },
  document: {
    description: 'An imported document file.',
    schema: DocumentSchema,
  },
  'system-model': {
    description: 'A system-model file written by the scanner.',
    schema: SystemModelSchema,
  },
} satisfies Record<string, FileContract>;

export type ContractName = keyof typeof contracts;

export const contractNames = Object.keys(contracts) as [
  ContractName,
  ...ContractName[],
];
