import { ChangeSchema } from '#backend/app/changes/model/change';
import { SystemModelSchema } from '#backend/app/system-model/model/system-model';
import type { FileContract } from '#backend/app/validation/validator';
import { designDocumentContract } from './design-document';
import { documentContract } from './document';

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
  document: documentContract,
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
