import type { BuildingBlockKind } from '#backend/app/system-model/system-model';

/**
 * The kinds a block holds as its state: the domain's values. A block of any
 * other kind is one a block works with, held as a collaborator. The kind
 * decides alone: a domain service held as a strategy is a collaborator, an
 * aggregate a repository caches is state.
 */
const STATE_KINDS: ReadonlySet<BuildingBlockKind> = new Set([
  'aggregate',
  'entity',
  'value_object',
  'event',
  'command',
  'query',
]);

/** Whether a block of this kind is held as a collaborator rather than as state. */
export const isCollaboratorKind = (type: BuildingBlockKind): boolean =>
  !STATE_KINDS.has(type);
