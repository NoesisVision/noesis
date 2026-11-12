import type { OutlineChange } from '#/features/design-docs/ui/model-tree/model-outline.ts';
import { nameOf } from '#/shared/model/element-id.ts';
import type { DesignDocumentInput } from '#backend/app/design-docs/design-doc.ts';
import { named } from './change-set.ts';
import { valueOf } from './design-doc-field.ts';

/*
 * Who drives the system, as a design reads it. An actor performs manual
 * processes, and a manual process invokes behaviors in order; nothing on a
 * behavior says who calls it. A manual process is shown under each actor that
 * performs it, and at the top when none does.
 */

/** The relations of a design that point at something, added or removed. */
const pointing = (doc: DesignDocumentInput) => [
  ...(doc.relations?.added ?? []),
  ...(doc.relations?.removed ?? []),
];

/** The actors the design says perform a manual process, by name. */
export function performersOf(
  doc: DesignDocumentInput,
  processId: string,
): string[] {
  return byName(
    pointing(doc).flatMap((relation) =>
      relation.kind === 'performs' && relation.to === processId
        ? [relation.from]
        : [],
    ),
  );
}

/** The manual processes the design says invoke a behavior, by name. */
export function invokersOf(
  doc: DesignDocumentInput,
  behaviorId: string,
): string[] {
  return byName(
    pointing(doc).flatMap((relation) =>
      relation.kind === 'process_invokes_behavior' && relation.to === behaviorId
        ? [relation.from]
        : [],
    ),
  );
}

/** One behavior a manual process calls, at its place in the process. */
export interface ProcessStep {
  behavior: string;
  /** Counting from 1; null where the design leaves the order unsaid. */
  order: number | null;
  change: OutlineChange;
}

/** The behaviors a manual process invokes, in order; one the design removes last. */
export function stepsOf(
  doc: DesignDocumentInput,
  processId: string,
): ProcessStep[] {
  const steps: ProcessStep[] = [];
  for (const [relation, change] of named(doc.relations))
    if (
      relation.kind === 'process_invokes_behavior' &&
      relation.from === processId
    )
      steps.push({
        behavior: relation.to,
        order: valueOf(relation.order),
        change,
      });
  for (const key of doc.relations?.removed ?? [])
    if (key.kind === 'process_invokes_behavior' && key.from === processId)
      steps.push({ behavior: key.to, order: null, change: 'removed' });
  return steps.sort(
    (a, b) =>
      (a.order ?? Number.MAX_SAFE_INTEGER) -
      (b.order ?? Number.MAX_SAFE_INTEGER),
  );
}

/** Where the tree shows a manual process first: under its first actor, else at the top. */
export function processPathOf(
  doc: DesignDocumentInput,
  processId: string,
): string {
  const [first] = performersOf(doc, processId);
  return first === undefined ? processId : processPathUnder(first, processId);
}

/** The row of a manual process under one actor that performs it. */
export const processPathUnder = (actorId: string, processId: string) =>
  `${actorId}#manual_process:${processId}`;

const byName = (ids: string[]) =>
  [...new Set(ids)].sort((a, b) => nameOf(a).localeCompare(nameOf(b)));
