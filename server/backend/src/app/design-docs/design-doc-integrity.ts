import type {
  DesignDocument,
  DesignedScenario,
} from '#backend/app/design-docs/model/design-doc';
import type { ElementRef } from '#backend/app/design-docs/model/design-doc-ref';
import {
  elementRef,
  type ModelPath,
  refForModelPath,
} from './design-doc-paths';

/*
 * Cross-element invariants zod cannot see, since it validates one object at a
 * time. Errors mean the document is inconsistent; warnings mean it resolves
 * but will read wrong.
 */

type DesignDocIssueSeverity = 'error' | 'warning';

export type DesignDocIssue = {
  readonly code: DesignDocIssueCode;
  readonly severity: DesignDocIssueSeverity;
  readonly ref: ElementRef;
  readonly message: string;
};

export type DesignDocIssueCode =
  | 'invalid-id'
  | 'duplicate-id'
  | 'unresolved-reference'
  | 'wrong-reference-type'
  | 'broken-pairing'
  | 'context-mismatch'
  | 'malformed-examples'
  | 'duplicate-actor-reference'
  | 'outline-without-examples'
  | 'examples-without-outline';

type Identified = { readonly id: string };

const quoted = (text: string): string => `"${text}"`;

const aOrAn = (noun: string): string =>
  /^[aeiou]/i.test(noun) ? `an ${noun}` : `a ${noun}`;

export function checkDesignDocument(
  document: DesignDocument,
): DesignDocIssue[] {
  const issues: DesignDocIssue[] = [];

  const at = (path: ModelPath): ElementRef =>
    refForModelPath(document, path) ?? elementRef(document.id);

  const add = (
    code: DesignDocIssueCode,
    severity: DesignDocIssueSeverity,
    ref: ElementRef,
    message: string,
  ): void => {
    issues.push({ code, severity, ref, message });
  };

  /*
   * Refs resolve through one document-wide index, so a duplicate id anywhere
   * makes the later element unreachable. Identity issues point at the
   * containing list: an empty id has no ref, and a duplicate id would resolve
   * to the element that claimed it first.
   */
  const seen = new Map<string, string>();
  const checkIds = (
    path: ModelPath,
    items: readonly Identified[],
    kind: string,
    owner: string,
  ): void => {
    if (items.length === 0) return;
    const here = at(path);
    for (const item of items) {
      if (item.id === '') {
        add(
          'invalid-id',
          'error',
          here,
          `An id is missing on ${aOrAn(kind)} in ${owner}, so nothing can reference it.`,
        );
        continue;
      }
      const taken = seen.get(item.id);
      if (taken !== undefined) {
        add(
          'duplicate-id',
          'error',
          here,
          `The id ${quoted(item.id)} on ${aOrAn(kind)} in ${owner} is already taken by ${taken}, so only one of the two can be addressed.`,
        );
        continue;
      }
      seen.set(item.id, `${aOrAn(kind)} in ${owner}`);
    }
  };

  const THE_DOCUMENT = 'the document';
  if (document.id !== '') seen.set(document.id, THE_DOCUMENT);

  checkIds(['actors'], document.actors, 'actor', THE_DOCUMENT);
  checkIds(
    ['boundedContexts'],
    document.boundedContexts,
    'bounded context',
    THE_DOCUMENT,
  );
  checkIds(
    ['domainModules'],
    document.domainModules,
    'domain module',
    THE_DOCUMENT,
  );
  checkIds(
    ['buildingBlocks'],
    document.buildingBlocks,
    'building block',
    THE_DOCUMENT,
  );
  checkIds(['useCases'], document.useCases, 'use case', THE_DOCUMENT);
  checkIds(['behaviours'], document.behaviours, 'behaviour', THE_DOCUMENT);
  checkIds(
    ['businessContext'],
    document.businessContext,
    'context paragraph',
    THE_DOCUMENT,
  );
  checkIds(['outcomes'], document.outcomes, 'target outcome', THE_DOCUMENT);
  checkIds(
    ['scope', 'inScope'],
    document.scope.inScope,
    'scope item',
    THE_DOCUMENT,
  );
  checkIds(
    ['scope', 'outOfScope'],
    document.scope.outOfScope,
    'scope item',
    THE_DOCUMENT,
  );

  const checkScenario = (
    path: ModelPath,
    scenario: DesignedScenario,
    owner: string,
  ): void => {
    const where = `scenario ${quoted(scenario.title)} in ${owner}`;
    checkIds([...path, 'background'], scenario.background, 'step', where);
    checkIds([...path, 'steps'], scenario.steps, 'step', where);

    const here = at(path);
    if (scenario.examples === null) {
      if (scenario.kind === 'scenarioOutline') {
        add(
          'outline-without-examples',
          'warning',
          here,
          `Scenario outline ${quoted(scenario.title)} has no examples table, so its placeholders never resolve.`,
        );
      }
      return;
    }

    if (scenario.kind !== 'scenarioOutline') {
      add(
        'examples-without-outline',
        'warning',
        here,
        `Scenario ${quoted(scenario.title)} carries an examples table but is not an outline.`,
      );
    }

    const width = scenario.examples.headers.length;
    checkIds(
      [...path, 'examples', 'rows'],
      scenario.examples.rows,
      'example row',
      where,
    );
    for (const [rowIndex, row] of scenario.examples.rows.entries()) {
      if (row.cells.length === width) continue;
      add(
        'malformed-examples',
        'error',
        at([...path, 'examples', 'rows', rowIndex]),
        `A row of the examples table in ${where} has ${row.cells.length} cells but the table has ${width} columns.`,
      );
    }
  };

  for (const [index, block] of document.buildingBlocks.entries()) {
    checkIds(
      ['buildingBlocks', index, 'properties'],
      block.properties,
      'property',
      `building block ${quoted(block.name)}`,
    );
  }

  for (const [index, useCase] of document.useCases.entries()) {
    const base: ModelPath = ['useCases', index];
    const owner = `use case ${quoted(useCase.name)}`;
    checkIds([...base, 'rules'], useCase.rules, 'rule', owner);
    checkIds(
      [...base, 'input', 'fields'],
      useCase.input.fields,
      'input field',
      owner,
    );
    checkIds(
      [...base, 'output', 'fields'],
      useCase.output.fields,
      'output field',
      owner,
    );
    checkIds(
      [...base, 'qualityAttributes'],
      useCase.qualityAttributes,
      'quality attribute',
      owner,
    );
    checkIds(
      [...base, 'acceptanceScenarios'],
      useCase.acceptanceScenarios,
      'acceptance scenario',
      owner,
    );
    for (const [at2, scenario] of useCase.acceptanceScenarios.entries()) {
      checkScenario([...base, 'acceptanceScenarios', at2], scenario, owner);
    }
  }

  for (const [index, behaviour] of document.behaviours.entries()) {
    const owner = `behaviour ${quoted(behaviour.name)}`;
    checkIds(
      ['behaviours', index, 'scenarios'],
      behaviour.scenarios,
      'behavioural scenario',
      owner,
    );
    for (const [at2, scenario] of behaviour.scenarios.entries()) {
      checkScenario(['behaviours', index, 'scenarios', at2], scenario, owner);
    }
  }

  const actorIds = new Set(document.actors.map((actor) => actor.id));
  const contextIds = new Set(
    document.boundedContexts.map((context) => context.id),
  );
  const moduleById = new Map(
    document.domainModules.map((module) => [module.id, module]),
  );
  const blockById = new Map(
    document.buildingBlocks.map((block) => [block.id, block]),
  );
  const useCaseById = new Map(
    document.useCases.map((useCase) => [useCase.id, useCase]),
  );
  const behaviourById = new Map(
    document.behaviours.map((behaviour) => [behaviour.id, behaviour]),
  );

  for (const [index, module] of document.domainModules.entries()) {
    if (contextIds.has(module.boundedContextId)) continue;
    add(
      'unresolved-reference',
      'error',
      at(['domainModules', index]),
      `Domain module ${quoted(module.name)} names bounded context ${quoted(module.boundedContextId)}, which is not in the document.`,
    );
  }

  for (const [index, block] of document.buildingBlocks.entries()) {
    const here = at(['buildingBlocks', index]);
    if (!contextIds.has(block.boundedContextId)) {
      add(
        'unresolved-reference',
        'error',
        here,
        `Building block ${quoted(block.name)} names bounded context ${quoted(block.boundedContextId)}, which is not in the document.`,
      );
    }
    if (block.domainModuleId === null) continue;
    const module = moduleById.get(block.domainModuleId);
    if (!module) {
      add(
        'unresolved-reference',
        'error',
        here,
        `Building block ${quoted(block.name)} names domain module ${quoted(block.domainModuleId)}, which is not in the document.`,
      );
      continue;
    }
    if (module.boundedContextId === block.boundedContextId) continue;
    add(
      'context-mismatch',
      'error',
      here,
      `Building block ${quoted(block.name)} is in bounded context ${quoted(block.boundedContextId)} but its domain module ${quoted(module.name)} is in ${quoted(module.boundedContextId)}.`,
    );
  }

  for (const [index, useCase] of document.useCases.entries()) {
    const here = at(['useCases', index]);

    if (useCase.applicationServiceId !== null) {
      const service = blockById.get(useCase.applicationServiceId);
      if (!service) {
        add(
          'unresolved-reference',
          'error',
          here,
          `Use case ${quoted(useCase.name)} names application service ${quoted(useCase.applicationServiceId)}, which is not a building block in the document.`,
        );
      } else if (service.type !== 'application_service') {
        add(
          'wrong-reference-type',
          'error',
          here,
          `Use case ${quoted(useCase.name)} is owned by ${quoted(service.name)}, which is a ${service.type ?? 'block of no stated type'} rather than an application service.`,
        );
      }
    }

    if (useCase.behaviourId !== null) {
      const behaviour = behaviourById.get(useCase.behaviourId);
      if (!behaviour) {
        add(
          'unresolved-reference',
          'error',
          here,
          `Use case ${quoted(useCase.name)} names entry-point behaviour ${quoted(useCase.behaviourId)}, which is not in the document.`,
        );
      } else if (behaviour.useCaseId !== useCase.id) {
        add(
          'broken-pairing',
          'error',
          here,
          `Use case ${quoted(useCase.name)} names behaviour ${quoted(behaviour.id)} as its entry point, but that behaviour names ${behaviour.useCaseId === null ? 'no use case' : quoted(behaviour.useCaseId)}.`,
        );
      }
    }

    const seenActors = new Set<string>();
    for (const actorId of useCase.actorIds) {
      if (!actorIds.has(actorId)) {
        add(
          'unresolved-reference',
          'error',
          here,
          `Use case ${quoted(useCase.name)} references actor ${quoted(actorId)}, which is not in the document.`,
        );
        continue;
      }
      if (seenActors.has(actorId)) {
        add(
          'duplicate-actor-reference',
          'warning',
          here,
          `Use case ${quoted(useCase.name)} references actor ${quoted(actorId)} twice.`,
        );
      }
      seenActors.add(actorId);
    }
  }

  for (const [index, behaviour] of document.behaviours.entries()) {
    const here = at(['behaviours', index]);

    if (!blockById.has(behaviour.buildingBlockId)) {
      add(
        'unresolved-reference',
        'error',
        here,
        `Behaviour ${quoted(behaviour.name)} belongs to building block ${quoted(behaviour.buildingBlockId)}, which is not in the document.`,
      );
    }

    if (behaviour.useCaseId === null) continue;
    const useCase = useCaseById.get(behaviour.useCaseId);
    if (!useCase) {
      add(
        'unresolved-reference',
        'error',
        here,
        `Behaviour ${quoted(behaviour.name)} names use case ${quoted(behaviour.useCaseId)}, which is not in the document.`,
      );
      continue;
    }
    if (useCase.behaviourId === behaviour.id) continue;
    add(
      'broken-pairing',
      'error',
      here,
      `Behaviour ${quoted(behaviour.name)} claims to be the entry point of ${quoted(useCase.name)}, but that use case names ${useCase.behaviourId === null ? 'no behaviour' : quoted(useCase.behaviourId)}.`,
    );
  }

  return issues;
}

export const isConsistentDesignDocument = (document: DesignDocument): boolean =>
  checkDesignDocument(document).every((issue) => issue.severity !== 'error');
