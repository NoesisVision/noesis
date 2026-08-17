/*
 * The block representation of a design document — the shape shared by the
 * BlockNote editor (frontend), the headless seeding pipeline (backend) and the
 * projection back to the portable specification (decision 51).
 *
 * Deliberately structural: no BlockNote import. A `DesignDocBlock` is what
 * BlockNote calls a block — id, type, props, inline content, children — but
 * expressed as plain data, so this package stays free of editor runtime and
 * both sides can depend on it. The BlockNote schemas (React renders on the
 * frontend, dummy renders for headless conversion on the backend) are built
 * from `blockSpecs` in `block-specs.ts`.
 *
 * Block ids are design-doc element ids (decision 51.7). The document fields
 * that are not elements — the goal, a use case's summary/description, the
 * output summary — get stable synthetic ids (`slot:` prefix), which is what
 * lets a slot ref resolve against the editor too.
 */

import type { DesignDocument, DesignedScenario } from '@repo/shared-contracts';

export const DESIGN_DOC_BLOCK_TYPES = [
  'goal',
  'contextParagraph',
  'outcome',
  'scopeItem',
  'actor',
  'contextHeading',
  'serviceHeading',
  'useCaseHeading',
  'useCaseSummary',
  'useCaseDescription',
  'rule',
  'fieldRow',
  'outputSummary',
  'scenario',
  'qualityAttribute',
] as const;
export type DesignDocBlockType = (typeof DESIGN_DOC_BLOCK_TYPES)[number];

/** One inline text run, the shape BlockNote stores inline content in. */
export interface InlineText {
  type: 'text';
  text: string;
  styles: Record<string, unknown>;
}

/**
 * A block as this package reads and writes it. `content` accepts a plain
 * string on the way in (BlockNote's PartialBlock does the same); blocks read
 * back from a Y.Doc carry styled runs, which the projection flattens to text —
 * the portable specification carries plain text (specification §14.8).
 */
export interface DesignDocBlock {
  id: string;
  type: DesignDocBlockType;
  props: Record<string, string | number | boolean>;
  content: string | InlineText[];
  children?: DesignDocBlock[];
}

export const slotId = {
  goal: 'slot:goal',
  summary: (useCaseId: string) => `slot:summary:${useCaseId}`,
  description: (useCaseId: string) => `slot:description:${useCaseId}`,
  outputSummary: (useCaseId: string) => `slot:output-summary:${useCaseId}`,
};

/**
 * What the blocks do not carry: document identity and the technical
 * vocabulary nothing renders this iteration (plan §3.6). Stored beside the
 * block list in the Y.Doc and merged back by `toDocument`. Only
 * whole-document writes (seeding, an accepted proposal) ever change it.
 */
export interface DesignDocSidecar {
  id: string;
  name: string;
  status: DesignDocument['status'];
  date: string;
  domainModules: DesignDocument['domainModules'];
  behaviours: DesignDocument['behaviours'];
  /** Building blocks that are not application services — never rendered. */
  otherBuildingBlocks: DesignDocument['buildingBlocks'];
  /** Unrendered fields of the application-service blocks, keyed by id. */
  serviceDetails: Record<
    string,
    {
      implements: string[];
      properties: DesignDocument['buildingBlocks'][number]['properties'];
    }
  >;
}

export interface DesignDocBlockDocument {
  blocks: DesignDocBlock[];
  sidecar: DesignDocSidecar;
}

const text = (value: string): string => value;

/**
 * The reading order, as blocks (plan §4): goal, business context, outcomes,
 * scope, actors, then per bounded context → application service → use case
 * the heading, summary, description, rules, input fields, output, acceptance
 * scenarios and quality attributes. Empty single fields produce no block —
 * that is what the "not written yet" line renders from.
 */
export function toBlocks(document: DesignDocument): DesignDocBlockDocument {
  const blocks: DesignDocBlock[] = [];
  const push = (
    id: string,
    type: DesignDocBlockType,
    props: Record<string, string | number | boolean>,
    content: string,
  ) => {
    blocks.push({ id, type, props, content: text(content) });
  };

  if (document.goal !== '') push(slotId.goal, 'goal', {}, document.goal);
  for (const paragraph of document.businessContext) {
    push(paragraph.id, 'contextParagraph', {}, paragraph.text);
  }
  for (const outcome of document.outcomes) {
    push(outcome.id, 'outcome', { measure: outcome.measure }, outcome.text);
  }
  for (const item of document.scope.inScope) {
    push(item.id, 'scopeItem', { scope: 'in' }, item.text);
  }
  for (const item of document.scope.outOfScope) {
    push(item.id, 'scopeItem', { scope: 'out' }, item.text);
  }
  for (const actor of document.actors) {
    push(
      actor.id,
      'actor',
      { kind: actor.kind, description: actor.description },
      actor.name,
    );
  }

  const services = document.buildingBlocks.filter(
    (block) => block.type === 'application_service',
  );
  const useCasesByService = new Map<string, DesignDocument['useCases']>();
  for (const useCase of document.useCases) {
    if (useCase.applicationServiceId === null) continue;
    const list = useCasesByService.get(useCase.applicationServiceId) ?? [];
    list.push(useCase);
    useCasesByService.set(useCase.applicationServiceId, list);
  }

  for (const context of document.boundedContexts) {
    push(
      context.id,
      'contextHeading',
      { description: context.description },
      context.name,
    );
    for (const service of services) {
      if (service.boundedContextId !== context.id) continue;
      push(
        service.id,
        'serviceHeading',
        {
          boundedContextId: service.boundedContextId,
          domainModuleId: service.domainModuleId ?? '',
          description: service.description,
        },
        service.name,
      );
      for (const useCase of useCasesByService.get(service.id) ?? []) {
        pushUseCase(useCase);
      }
    }
  }

  function pushUseCase(useCase: DesignDocument['useCases'][number]): void {
    push(
      useCase.id,
      'useCaseHeading',
      {
        type: useCase.type ?? '',
        applicationServiceId: useCase.applicationServiceId ?? '',
        behaviourId: useCase.behaviourId ?? '',
        actorIds: JSON.stringify(useCase.actorIds),
      },
      useCase.name,
    );
    if (useCase.summary !== '') {
      push(
        slotId.summary(useCase.id),
        'useCaseSummary',
        { useCaseId: useCase.id },
        useCase.summary,
      );
    }
    if (useCase.description !== '') {
      push(
        slotId.description(useCase.id),
        'useCaseDescription',
        { useCaseId: useCase.id, author: useCase.descriptionAuthor },
        useCase.description,
      );
    }
    for (const rule of useCase.rules) {
      push(
        rule.id,
        'rule',
        {
          useCaseId: useCase.id,
          ruleType: rule.ruleType ?? '',
          author: rule.author,
        },
        rule.text,
      );
    }
    for (const field of useCase.input.fields) {
      push(
        field.id,
        'fieldRow',
        {
          useCaseId: useCase.id,
          direction: 'input',
          name: field.name,
          fieldType: field.type,
          note: field.note,
        },
        field.label,
      );
    }
    if (useCase.output.summary !== '') {
      push(
        slotId.outputSummary(useCase.id),
        'outputSummary',
        { useCaseId: useCase.id },
        useCase.output.summary,
      );
    }
    for (const field of useCase.output.fields) {
      push(
        field.id,
        'fieldRow',
        {
          useCaseId: useCase.id,
          direction: 'output',
          name: field.name,
          fieldType: field.type,
          note: field.note,
        },
        field.label,
      );
    }
    for (const scenario of useCase.acceptanceScenarios) {
      blocks.push({
        id: scenario.id,
        type: 'scenario',
        props: { useCaseId: useCase.id, data: JSON.stringify(scenario) },
        content: [],
      });
    }
    for (const attribute of useCase.qualityAttributes) {
      push(
        attribute.id,
        'qualityAttribute',
        {
          useCaseId: useCase.id,
          name: attribute.name,
          qaType: attribute.type ?? '',
          author: attribute.author,
        },
        attribute.text,
      );
    }
  }

  const serviceDetails: DesignDocSidecar['serviceDetails'] = {};
  for (const service of services) {
    serviceDetails[service.id] = {
      implements: service.implements,
      properties: service.properties,
    };
  }

  return {
    blocks,
    sidecar: {
      id: document.id,
      name: document.name,
      status: document.status,
      date: document.date,
      domainModules: document.domainModules,
      behaviours: document.behaviours,
      otherBuildingBlocks: document.buildingBlocks.filter(
        (block) => block.type !== 'application_service',
      ),
      serviceDetails,
    },
  };
}

/** Flatten inline content back to the plain text the specification carries. */
export function blockText(block: DesignDocBlock): string {
  if (block.content === undefined || block.content === null) return '';
  if (typeof block.content === 'string') return block.content;
  return block.content.map((run) => run.text).join('');
}

export type { DesignedScenario };
