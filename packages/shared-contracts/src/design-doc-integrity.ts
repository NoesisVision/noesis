import type { DesignDocument, DesignedScenario } from './design-doc.js';
import {
  type ElementRef,
  elementRef,
  type ModelPath,
  refForModelPath,
} from './design-doc-ref.js';

/*
 * Whole-document invariants.
 *
 * The element schemas cannot see any of this. A normalised model relates its
 * parts by id, and zod validates one object at a time, so nothing in
 * `design-doc.ts` can tell whether `applicationServiceId` names a real building
 * block, whether that block is actually an application service, or whether the
 * use case and the behaviour that claim each other agree.
 *
 * Two families of check, and both matter for a different reason:
 *
 * - **Identity.** An element reference is a bare id resolved through one index,
 *   so a collision anywhere in the document makes the loser unreachable —
 *   every comment, suggestion and agent reference silently lands on the other.
 *   Ids also may not be empty.
 * - **References.** A dangling id is a broken document; a reference that
 *   resolves to the wrong kind of thing is worse, because it looks fine.
 *
 * Errors mean the document is inconsistent. Warnings mean it parses and
 * resolves but will read wrong — a stale baseline snapshot quietly produces
 * incorrect delta markers, which is exactly the failure decision 49 exists to
 * prevent.
 *
 * Each issue carries a `ref` for a caller to navigate to and a `message` that
 * names the element in words, so neither side needs a rendered path.
 */

export type DesignDocIssueSeverity = 'error' | 'warning';

export type DesignDocIssue = {
  /** Stable machine-readable code, so callers can filter without matching prose. */
  readonly code: DesignDocIssueCode;
  readonly severity: DesignDocIssueSeverity;
  /** Where to send a reader. For an identity issue this is the containing list. */
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
  | 'stale-baseline'
  | 'removal-without-baseline'
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

  /** A ref for a path, falling back to the document when nothing is there. */
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
   * Ids are unique across the whole document, not merely within the array that
   * holds them. `seen` remembers how each claim was described so a collision
   * can say what it collided with.
   *
   * Identity issues point at the containing list rather than at the offending
   * element: an empty id has no ref, and a duplicate id would resolve to the
   * element that claimed it first.
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

  /* ------------------------------------------------------------- identity */

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

  /* ----------------------------------------------------------- references */

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

  /* ------------------------------------------------------------- baseline */

  const activeScanId = document.baseline?.active.scanId ?? null;

  const checkBaseline = (
    path: ModelPath,
    element: {
      readonly name: string;
      readonly baseline: { readonly scanId: string } | null;
      readonly markedForRemoval: boolean;
    },
  ): void => {
    const here = at(path);
    if (element.baseline === null) {
      if (element.markedForRemoval) {
        add(
          'removal-without-baseline',
          'warning',
          here,
          `${quoted(element.name)} is marked for removal but the baseline has never seen it, so there is nothing in the codebase to remove — delete it instead.`,
        );
      }
      return;
    }
    if (element.baseline.scanId === activeScanId) return;
    add(
      'stale-baseline',
      'warning',
      here,
      activeScanId === null
        ? `${quoted(element.name)} compares against scan ${quoted(element.baseline.scanId)} but the document names no active baseline.`
        : `${quoted(element.name)} compares against scan ${quoted(element.baseline.scanId)} while the document's baseline is ${quoted(activeScanId)}, so its delta marker may be wrong.`,
    );
  };

  const snapshotted = [
    ['actors', document.actors],
    ['boundedContexts', document.boundedContexts],
    ['domainModules', document.domainModules],
    ['buildingBlocks', document.buildingBlocks],
    ['useCases', document.useCases],
    ['behaviours', document.behaviours],
  ] as const;

  for (const [collection, elements] of snapshotted) {
    for (const [index, element] of elements.entries()) {
      checkBaseline([collection, index], element);
    }
  }

  return issues;
}

/** True when the document holds together — warnings do not count against it. */
export const isConsistentDesignDocument = (document: DesignDocument): boolean =>
  checkDesignDocument(document).every((issue) => issue.severity !== 'error');
