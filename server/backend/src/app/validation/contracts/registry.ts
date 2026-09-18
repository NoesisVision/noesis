import type { FileContract } from '#backend/app/validation/validator';
import {
  ChangeSchema,
  ConversationAnalysisSchema,
  ConversationSchema,
  DecisionSchema,
  DocumentAnalysisSchema,
  DocumentSchema,
  SystemModelSchema,
  TopicSchema,
} from '#backend/shared/contracts';
import { designDocumentContract } from './design-document';

/**
 * Every file contract the agent can validate against, keyed by the name the
 * `validate` tool takes. A contract is the zod schema from the contracts
 * package plus, where the service has one, the whole-document check it runs
 * on write — so what `validate` says and what a write rejects are the same.
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
  'conversation-analysis': {
    description:
      'The payload of a conversation import: the conversation plus its topics and decisions.',
    schema: ConversationAnalysisSchema,
  },
  'document-analysis': {
    description:
      'The payload of a document import: the document plus its topics and decisions.',
    schema: DocumentAnalysisSchema,
  },
  topic: {
    description: 'A wiki topic file.',
    schema: TopicSchema,
  },
  decision: {
    description: 'A wiki decision file.',
    schema: DecisionSchema,
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
