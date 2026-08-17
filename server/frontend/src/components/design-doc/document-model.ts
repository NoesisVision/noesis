import type { DesignDocumentDto } from '@/lib/design-docs';

/*
 * The reading-order model over a `DesignDocument` (plan §1): goal, business
 * context, target outcomes, scope, actors, then use cases grouped by bounded
 * context and application service. Pure derivation — the components render it,
 * the table of contents walks it, and the numbering lives nowhere else.
 */

export type UseCase = DesignDocumentDto['useCases'][number];
export type Actor = DesignDocumentDto['actors'][number];
export type BuildingBlock = DesignDocumentDto['buildingBlocks'][number];
export type AcceptanceScenario = UseCase['acceptanceScenarios'][number];

export interface OutlineItem {
  /** Anchor id in the page, `sec-<element id>` for element-bound headings. */
  id: string;
  level: 1 | 2 | 3;
  num: string;
  title: string;
}

export interface NumberedUseCase {
  num: string;
  useCase: UseCase;
}

export interface ServiceGroup {
  num: string;
  service: BuildingBlock;
  useCases: NumberedUseCase[];
}

export interface ContextGroup {
  num: string;
  context: DesignDocumentDto['boundedContexts'][number];
  services: ServiceGroup[];
  useCaseCount: number;
}

export interface DocumentModel {
  outline: OutlineItem[];
  contexts: ContextGroup[];
  actorsById: Map<string, Actor>;
  servicesById: Map<string, BuildingBlock>;
}

/** The five fixed document sections ahead of the use cases. */
export const FIXED_SECTIONS = [
  { id: 'sec-goal', title: 'Goal' },
  { id: 'sec-context', title: 'Business context' },
  { id: 'sec-outcomes', title: 'Target outcomes' },
  { id: 'sec-scope', title: 'Scope' },
  { id: 'sec-actors', title: 'Actors' },
] as const;

export function buildDocumentModel(document: DesignDocumentDto): DocumentModel {
  const outline: OutlineItem[] = FIXED_SECTIONS.map((section, index) => ({
    id: section.id,
    level: 1,
    num: String(index + 1),
    title: section.title,
  }));

  const servicesById = new Map(
    document.buildingBlocks
      .filter((block) => block.type === 'application_service')
      .map((block) => [block.id, block]),
  );
  const useCasesByService = new Map<string, UseCase[]>();
  for (const useCase of document.useCases) {
    if (useCase.applicationServiceId === null) continue;
    const list = useCasesByService.get(useCase.applicationServiceId) ?? [];
    list.push(useCase);
    useCasesByService.set(useCase.applicationServiceId, list);
  }

  let sectionCount = FIXED_SECTIONS.length;
  const contexts: ContextGroup[] = [];
  for (const context of document.boundedContexts) {
    sectionCount += 1;
    const contextNum = String(sectionCount);
    const services: ServiceGroup[] = [];
    let serviceIndex = 0;
    for (const service of servicesById.values()) {
      if (service.boundedContextId !== context.id) continue;
      serviceIndex += 1;
      const serviceNum = `${contextNum}.${serviceIndex}`;
      const useCases = (useCasesByService.get(service.id) ?? []).map(
        (useCase, index) => ({
          num: `${serviceNum}.${index + 1}`,
          useCase,
        }),
      );
      services.push({ num: serviceNum, service, useCases });
    }

    outline.push({
      id: `sec-${context.id}`,
      level: 1,
      num: contextNum,
      title: `${context.name} context`,
    });
    for (const group of services) {
      outline.push({
        id: `sec-${group.service.id}`,
        level: 2,
        num: group.num,
        title: group.service.name,
      });
      for (const { num, useCase } of group.useCases) {
        outline.push({
          id: `sec-${useCase.id}`,
          level: 3,
          num,
          title: useCase.name,
        });
      }
    }

    contexts.push({
      num: contextNum,
      context,
      services,
      useCaseCount: services.reduce((n, s) => n + s.useCases.length, 0),
    });
  }

  return {
    outline,
    contexts,
    actorsById: new Map(document.actors.map((actor) => [actor.id, actor])),
    servicesById,
  };
}

/**
 * The sections of a use case that hold nothing, in the order the specification
 * fixes — named once in one quiet line instead of printed as empty boxes.
 */
export function missingSections(useCase: UseCase): string[] {
  const missing: string[] = [];
  if (useCase.summary === '') missing.push('summary');
  if (useCase.description === '') missing.push('description');
  if (useCase.rules.length === 0) missing.push('rules');
  if (useCase.input.fields.length === 0) missing.push('input');
  if (useCase.output.summary === '' && useCase.output.fields.length === 0) {
    missing.push('output');
  }
  if (useCase.acceptanceScenarios.length === 0) {
    missing.push('acceptance scenarios');
  }
  if (useCase.qualityAttributes.length === 0) {
    missing.push('quality attributes');
  }
  return missing;
}
