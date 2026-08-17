/*
 * The projection: blocks (plus sidecar) back to the portable `DesignDocument`
 * (decision 51 — derived on read, never a second store). Elements attach to
 * their owners through explicit props (`useCaseId`, `applicationServiceId`),
 * not through position, so a drag that reorders blocks cannot re-home an
 * element; block order decides only the order inside each schema array.
 *
 * The projection is deliberately total over anything the block schema can
 * produce; whether the result is a *consistent* document is
 * `checkDesignDocument`'s question, and an inconsistency there means the
 * editor schema failed, not the projection (plan §8).
 */

import {
  type DesignDocument,
  DesignDocumentSchema,
  type DesignedScenario,
  DesignedScenarioSchema,
} from '@repo/shared-contracts';
import {
  blockText,
  type DesignDocBlock,
  type DesignDocSidecar,
} from './blocks.js';

const asString = (value: unknown): string =>
  typeof value === 'string' ? value : '';

const orNull = (value: string): string | null => (value === '' ? null : value);

function parseScenario(block: DesignDocBlock): DesignedScenario {
  try {
    const raw: unknown = JSON.parse(asString(block.props.data));
    return DesignedScenarioSchema.parse({
      ...(typeof raw === 'object' && raw !== null ? raw : {}),
      id: block.id,
    });
  } catch {
    // An unreadable scenario payload degrades to an empty scenario rather
    // than failing the whole projection; integrity flags what is missing.
    return DesignedScenarioSchema.parse({ id: block.id, title: '' });
  }
}

function parseActorIds(value: unknown): string[] {
  try {
    const parsed: unknown = JSON.parse(asString(value));
    return Array.isArray(parsed)
      ? parsed.filter((id) => typeof id === 'string')
      : [];
  } catch {
    return [];
  }
}

export function toDocument(
  blocks: DesignDocBlock[],
  sidecar: DesignDocSidecar,
): DesignDocument {
  let goal = '';
  const businessContext: { id: string; text: string }[] = [];
  const outcomes: { id: string; text: string; measure: string }[] = [];
  const inScope: { id: string; text: string }[] = [];
  const outOfScope: { id: string; text: string }[] = [];
  const actors: unknown[] = [];
  const boundedContexts: unknown[] = [];
  const services: unknown[] = [];
  const useCaseOrder: string[] = [];
  const useCases = new Map<string, Record<string, unknown>>();

  const useCase = (id: string): Record<string, unknown> => {
    let entry = useCases.get(id);
    if (entry === undefined) {
      // An element whose use case has no heading block still projects; the
      // integrity check reports the dangling reference afterwards.
      entry = emptyUseCase(id);
      useCases.set(id, entry);
      useCaseOrder.push(id);
    }
    return entry;
  };

  for (const block of blocks) {
    const content = blockText(block);
    switch (block.type) {
      case 'goal':
        goal = content;
        break;
      case 'contextParagraph':
        businessContext.push({ id: block.id, text: content });
        break;
      case 'outcome':
        outcomes.push({
          id: block.id,
          text: content,
          measure: asString(block.props.measure),
        });
        break;
      case 'scopeItem':
        (block.props.scope === 'out' ? outOfScope : inScope).push({
          id: block.id,
          text: content,
        });
        break;
      case 'actor':
        actors.push({
          id: block.id,
          name: content,
          kind: block.props.kind === 'system' ? 'system' : 'human',
          description: asString(block.props.description),
        });
        break;
      case 'contextHeading':
        boundedContexts.push({
          id: block.id,
          name: content,
          description: asString(block.props.description),
        });
        break;
      case 'serviceHeading':
        services.push({
          id: block.id,
          name: content,
          type: 'application_service',
          boundedContextId: asString(block.props.boundedContextId),
          domainModuleId: orNull(asString(block.props.domainModuleId)),
          description: asString(block.props.description),
          implements: sidecar.serviceDetails[block.id]?.implements ?? [],
          properties: sidecar.serviceDetails[block.id]?.properties ?? [],
        });
        break;
      case 'useCaseHeading': {
        const entry = useCase(block.id);
        entry.name = content;
        entry.type = orNull(asString(block.props.type));
        entry.applicationServiceId = orNull(
          asString(block.props.applicationServiceId),
        );
        entry.behaviourId = orNull(asString(block.props.behaviourId));
        entry.actorIds = parseActorIds(block.props.actorIds);
        break;
      }
      case 'useCaseSummary':
        useCase(asString(block.props.useCaseId)).summary = content;
        break;
      case 'useCaseDescription': {
        const entry = useCase(asString(block.props.useCaseId));
        entry.description = content;
        entry.descriptionAuthor =
          block.props.author === 'human' ? 'human' : 'agent';
        break;
      }
      case 'rule':
        (useCase(asString(block.props.useCaseId)).rules as unknown[]).push({
          id: block.id,
          text: content,
          ruleType: orNull(asString(block.props.ruleType)),
          author: block.props.author === 'human' ? 'human' : 'agent',
        });
        break;
      case 'fieldRow': {
        const entry = useCase(asString(block.props.useCaseId));
        const field = {
          id: block.id,
          name: asString(block.props.name),
          label: content,
          type: asString(block.props.fieldType),
          note: asString(block.props.note),
        };
        const holder =
          block.props.direction === 'output'
            ? (entry.output as { fields: unknown[] })
            : (entry.input as { fields: unknown[] });
        holder.fields.push(field);
        break;
      }
      case 'outputSummary':
        (
          useCase(asString(block.props.useCaseId)).output as {
            summary: string;
          }
        ).summary = content;
        break;
      case 'scenario':
        (
          useCase(asString(block.props.useCaseId))
            .acceptanceScenarios as unknown[]
        ).push(parseScenario(block));
        break;
      case 'qualityAttribute':
        (
          useCase(asString(block.props.useCaseId))
            .qualityAttributes as unknown[]
        ).push({
          id: block.id,
          name: asString(block.props.name),
          text: content,
          type: orNull(asString(block.props.qaType)),
          author: block.props.author === 'human' ? 'human' : 'agent',
        });
        break;
    }
  }

  return DesignDocumentSchema.parse({
    id: sidecar.id,
    name: sidecar.name,
    status: sidecar.status,
    date: sidecar.date,
    goal,
    businessContext,
    outcomes,
    scope: { inScope, outOfScope },
    actors,
    boundedContexts,
    domainModules: sidecar.domainModules,
    buildingBlocks: [...services, ...sidecar.otherBuildingBlocks],
    useCases: useCaseOrder.map((id) => useCases.get(id)),
    behaviours: sidecar.behaviours,
  });
}

function emptyUseCase(id: string): Record<string, unknown> {
  return {
    id,
    name: '',
    type: null,
    applicationServiceId: null,
    behaviourId: null,
    actorIds: [],
    summary: '',
    description: '',
    descriptionAuthor: 'agent',
    rules: [],
    input: { fields: [] },
    output: { summary: '', fields: [] },
    acceptanceScenarios: [],
    qualityAttributes: [],
  };
}
