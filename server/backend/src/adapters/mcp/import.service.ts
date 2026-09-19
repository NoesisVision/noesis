import { v7 as uuidv7 } from 'uuid';
import type { NoesisChangesRepository } from '#backend/adapters/store/changes.repository';
import type {
  DecisionsStore,
  TopicsStore,
} from '#backend/adapters/store/wiki.store';
import { ChangeSlug } from '#backend/app/changes/change-slug';
import type { ChangesService } from '#backend/app/changes/changes.service';
import {
  type AnalyzedTopic,
  ConversationAnalysisSchema,
} from '#backend/app/information-sources/model/conversation-analysis';
import { DocumentAnalysisSchema } from '#backend/app/information-sources/model/document-analysis';
import type { InformationFragmentRef } from '#backend/app/information-sources/model/information-fragment';
import {
  type FileContract,
  type ValidationIssue,
  validate,
} from '#backend/app/validation/validator';
import type { Decision } from '#backend/app/wiki/model/decision';
import type { Topic } from '#backend/app/wiki/model/topic';
import {
  contentHashAsUuid,
  sha256,
} from '#backend/platform/crypto/content-hash';
import { dataFileOf } from '#backend/platform/files/noesis-store';

export interface ImportDeps {
  changes: ChangesService;
  changesRepository: NoesisChangesRepository;
  topics: TopicsStore;
  decisions: DecisionsStore;
}

export interface ImportReport {
  source: { kind: 'conversation' | 'document'; id: string; path: string };
  topics: { created: string[]; updated: string[] };
  decisions: { created: string[]; updated: string[] };
}

/** Raised before anything is written. */
export class DuplicateSourceError extends Error {
  readonly id: string;
  readonly path: string;

  constructor(kind: string, id: string, path: string) {
    super(`This ${kind} was imported before as ${path}.`);
    this.name = 'DuplicateSourceError';
    this.id = id;
    this.path = path;
  }
}

export class InvalidImportError extends Error {
  readonly contract: string;
  readonly issues: readonly ValidationIssue[];
  readonly suppressed: number;

  constructor(
    contract: string,
    issues: readonly ValidationIssue[],
    suppressed: number,
  ) {
    super(`${contract} rejected: ${issues.map((i) => i.path).join(', ')}`);
    this.name = 'InvalidImportError';
    this.contract = contract;
    this.issues = issues;
    this.suppressed = suppressed;
  }
}

// The source id hashes its content, so importing the same source twice is a
// duplicate. Placeholder topic ids in the payload map to fresh ids, so an
// analysis can wire new topics to each other before the ids exist.
export class ImportService {
  private readonly deps: ImportDeps;

  constructor(deps: ImportDeps) {
    this.deps = deps;
  }

  async importConversation(
    slug: ChangeSlug,
    payload: unknown,
  ): Promise<ImportReport> {
    await this.deps.changes.assertExists(slug);
    const { conversation, topics } = parse(
      'conversation-analysis',
      { description: '', schema: ConversationAnalysisSchema },
      payload,
    );
    const placeholderId = conversation.conversation_id;
    const id = contentHashAsUuid(JSON.stringify(conversation.turns));
    await this.assertNew('conversation', id);
    await this.assertTopicsResolve('conversation-analysis', topics);
    const conversations =
      this.deps.changesRepository.children(slug).conversations;
    const stored = { ...conversation, conversation_id: id };
    await conversations.set(id, stored);
    const sourceSha = sha256(JSON.stringify(stored));
    const refs = (ref: InformationFragmentRef): InformationFragmentRef =>
      ref.type === 'conversation_fragment_ref' &&
      ref.conversation_id === placeholderId
        ? { ...ref, conversation_id: id, source_sha: sourceSha }
        : ref;
    return {
      source: {
        kind: 'conversation',
        id,
        path: dataFileOf(conversations, id),
      },
      ...(await this.applyTopics(topics, refs)),
    };
  }

  async importDocument(
    slug: ChangeSlug,
    payload: unknown,
  ): Promise<ImportReport> {
    await this.deps.changes.assertExists(slug);
    const { document, topics } = parse(
      'document-analysis',
      { description: '', schema: DocumentAnalysisSchema },
      payload,
    );
    const placeholderId = document.document_id;
    const id = contentHashAsUuid(JSON.stringify(document.fragments));
    await this.assertNew('document', id);
    await this.assertTopicsResolve('document-analysis', topics);
    const documents = this.deps.changesRepository.children(slug).documents;
    const stored = { ...document, document_id: id };
    await documents.set(id, stored);
    const sourceSha = sha256(JSON.stringify(stored));
    const refs = (ref: InformationFragmentRef): InformationFragmentRef =>
      ref.type === 'document_fragment_ref' && ref.document_id === placeholderId
        ? { ...ref, document_id: id, source_sha: sourceSha }
        : ref;
    return {
      source: {
        kind: 'document',
        id,
        path: dataFileOf(documents, id),
      },
      ...(await this.applyTopics(topics, refs)),
    };
  }

  /** A source id is global: the same content in any change is the same source. */
  private async assertNew(
    kind: 'conversation' | 'document',
    id: string,
  ): Promise<void> {
    const collection = kind === 'conversation' ? 'conversations' : 'documents';
    for (const change of await this.deps.changes.list()) {
      const slug = ChangeSlug.parse(change.slug);
      const sources = this.deps.changesRepository.children(slug)[collection];
      if ((await sources.get(id)) !== null) {
        throw new DuplicateSourceError(kind, id, dataFileOf(sources, id));
      }
    }
  }

  // Runs before the source file is written, so a rejected payload leaves
  // nothing behind.
  private async assertTopicsResolve(
    contract: string,
    analyzed: AnalyzedTopic[],
  ): Promise<void> {
    for (const [index, topic] of analyzed.entries()) {
      if (topic.is_new) continue;
      if ((await this.deps.topics.get(topic.id)) !== null) continue;
      throw new InvalidImportError(
        contract,
        [
          {
            path: `$.topics[${index}].id`,
            expected: 'the id of an existing wiki topic, or is_new: true',
            found: JSON.stringify(topic.id),
            fix: 'Set is_new to true for a new topic, or use the id of a topic that exists',
          },
        ],
        0,
      );
    }
  }

  private async applyTopics(
    analyzed: AnalyzedTopic[],
    refs: (ref: InformationFragmentRef) => InformationFragmentRef,
  ): Promise<Pick<ImportReport, 'topics' | 'decisions'>> {
    const report = {
      topics: { created: [] as string[], updated: [] as string[] },
      decisions: { created: [] as string[], updated: [] as string[] },
    };

    // Placeholders first, so a new topic can be another's parent.
    const ids = new Map<string, string>();
    for (const topic of analyzed) {
      ids.set(topic.id, topic.is_new ? uuidv7() : topic.id);
    }
    const resolve = (id: string | null): string | null =>
      id === null ? null : (ids.get(id) ?? id);

    for (const topic of analyzed) {
      const id = resolve(topic.id) ?? topic.id;
      const incoming: Topic = {
        id,
        parent_id: resolve(topic.parent_id),
        title: topic.title,
        title_locked: false,
        short_summary: topic.short_summary,
        short_summary_locked: false,
        long_summary: topic.long_summary,
        long_summary_locked: false,
        items: topic.items.map(refs),
      };
      const existing = topic.is_new ? null : await this.deps.topics.get(id);
      await this.deps.topics.set(
        id,
        existing === null ? incoming : mergeTopic(existing, incoming),
      );
      (existing === null ? report.topics.created : report.topics.updated).push(
        id,
      );

      for (const analyzedDecision of topic.decisions) {
        const decisionId = analyzedDecision.id ?? uuidv7();
        const incomingDecision: Decision = {
          id: decisionId,
          topic_id: id,
          title: analyzedDecision.title,
          title_locked: false,
          status: analyzedDecision.status,
          status_locked: false,
          context: {
            ...analyzedDecision.context,
            supporting_info: analyzedDecision.context.supporting_info.map(refs),
          },
          decision: {
            ...analyzedDecision.decision,
            supporting_info:
              analyzedDecision.decision.supporting_info.map(refs),
          },
          alternative_options: analyzedDecision.alternative_options.map(
            (o) => ({ ...o, supporting_info: o.supporting_info.map(refs) }),
          ),
        };
        const existingDecision =
          analyzedDecision.id === undefined
            ? null
            : await this.deps.decisions.get(decisionId);
        await this.deps.decisions.set(
          decisionId,
          existingDecision === null
            ? incomingDecision
            : mergeDecision(existingDecision, incomingDecision),
        );
        (existingDecision === null
          ? report.decisions.created
          : report.decisions.updated
        ).push(decisionId);
      }
    }
    return report;
  }
}

function parse<T>(
  name: string,
  contract: FileContract<T>,
  payload: unknown,
): T {
  const report = validate(contract, payload);
  if (!report.ok) {
    throw new InvalidImportError(name, report.issues, report.suppressed);
  }
  return report.value;
}

function mergeTopic(stored: Topic, incoming: Topic): Topic {
  return {
    id: stored.id,
    parent_id: incoming.parent_id,
    title: stored.title_locked ? stored.title : incoming.title,
    title_locked: stored.title_locked,
    short_summary: stored.short_summary_locked
      ? stored.short_summary
      : incoming.short_summary,
    short_summary_locked: stored.short_summary_locked,
    long_summary: stored.long_summary_locked
      ? stored.long_summary
      : incoming.long_summary,
    long_summary_locked: stored.long_summary_locked,
    items: unionRefs(stored.items, incoming.items),
  };
}

function mergeDecision(stored: Decision, incoming: Decision): Decision {
  return {
    id: stored.id,
    topic_id: incoming.topic_id,
    title: stored.title_locked ? stored.title : incoming.title,
    title_locked: stored.title_locked,
    status: stored.status_locked ? stored.status : incoming.status,
    status_locked: stored.status_locked,
    context: {
      text: stored.context.text_locked
        ? stored.context.text
        : incoming.context.text,
      text_locked: stored.context.text_locked,
      supporting_info: unionRefs(
        stored.context.supporting_info,
        incoming.context.supporting_info,
      ),
    },
    decision: mergeOption(stored.decision, incoming.decision),
    // Alternatives are replaced as a list; a person's edits to one would need
    // a per-option identity to survive, which the contract does not have.
    alternative_options: incoming.alternative_options,
  };
}

function mergeOption(
  stored: Decision['decision'],
  incoming: Decision['decision'],
): Decision['decision'] {
  return {
    text: stored.text_locked ? stored.text : incoming.text,
    text_locked: stored.text_locked,
    rationale: stored.rationale_locked ? stored.rationale : incoming.rationale,
    rationale_locked: stored.rationale_locked,
    supporting_info: unionRefs(
      stored.supporting_info,
      incoming.supporting_info,
    ),
  };
}

function unionRefs(
  a: InformationFragmentRef[],
  b: InformationFragmentRef[],
): InformationFragmentRef[] {
  const seen = new Set<string>();
  const out: InformationFragmentRef[] = [];
  for (const ref of [...a, ...b]) {
    const { source_sha: _sha, ...identity } = ref;
    const key = JSON.stringify(identity);
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(ref);
  }
  return out;
}
