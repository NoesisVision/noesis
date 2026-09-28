import type { DesignedBehaviourInput } from '#backend/app/design-docs/design-doc.ts';
import type { BuildingBlockRefInput } from '#backend/app/system-model/system-model.ts';
import { valueOf } from '../../../design-doc-field.ts';
import type { ChangeSetInput } from '../change-set.ts';

/*
 * Whether a section has anything to show. An aggregator leaves a section out
 * rather than letting it render nothing, so the divider between two sections
 * never stands beside an empty one.
 */

/** Whether the design touches a change set of references at all. */
export const hasRefs = (
  set: ChangeSetInput<BuildingBlockRefInput, BuildingBlockRefInput> | undefined,
): boolean =>
  !!(set?.added?.length || set?.modified?.length || set?.removed?.length);

/** Whether the design opens a behaviour to callers. */
export const isPublic = (
  field: DesignedBehaviourInput['visibility'],
): boolean => valueOf(field)?.kind === 'public';
