import { ChangeSchema } from '#backend/app/changes/model/change';
import { ConversationSchema } from '#backend/app/information-sources/model/conversation';
import { ConversationAnalysisSchema } from '#backend/app/information-sources/model/conversation-analysis';
import { DocumentSchema } from '#backend/app/information-sources/model/document';
import { DocumentAnalysisSchema } from '#backend/app/information-sources/model/document-analysis';
import { SystemModelSchema } from '#backend/app/system-model/model/system-model';
import type { FileContract } from '#backend/app/validation/validator';
import { DecisionSchema } from '#backend/app/wiki/model/decision';
import { TopicSchema } from '#backend/app/wiki/model/topic';
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
