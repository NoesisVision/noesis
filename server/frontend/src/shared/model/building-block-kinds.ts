import type { BuildingBlockKind } from '#backend/app/system-model/system-model.ts';

/*
 * The building block kinds, as the model spells them, each with what it is
 * — one table, so a kind the model gains is missing here until it is placed,
 * and every list of kinds the page keeps is read off it rather than typed out
 * again. The page may not run backend code, so this is a copy of the
 * contract's enum, held to it by its type.
 */
const WHAT_IT_IS = {
  aggregate: 'object',
  entity: 'object',
  value_object: 'value',
  domain_service: 'service',
  application_service: 'application',
  repository: 'drivenPort',
  factory: 'service',
  external_integration: 'drivenPort',
  in_adapter: 'adapter',
  out_adapter: 'adapter',
  technical_service: 'technical',
  command: 'message',
  event: 'message',
  query: 'message',
} as const satisfies Record<BuildingBlockKind, string>;

/** Every building block kind, in the model's order. */
export const BUILDING_BLOCK_KINDS = Object.keys(
  WHAT_IT_IS,
) as BuildingBlockKind[];

const ofWhat = (...what: (typeof WHAT_IT_IS)[BuildingBlockKind][]) =>
  BUILDING_BLOCK_KINDS.filter((kind) => what.includes(WHAT_IT_IS[kind]));

/** The values the domain passes around: a value object and the messages. */
export const PASSED_VALUES: readonly BuildingBlockKind[] = ofWhat(
  'value',
  'message',
);

/** The types a contract is made of: the domain's objects, values and messages. */
export const DOMAIN_TYPES: readonly BuildingBlockKind[] = ofWhat(
  'object',
  'value',
  'message',
);

/** The ports a hexagon drives: its repositories and external integrations. */
export const DRIVEN_PORTS: readonly BuildingBlockKind[] = ofWhat('drivenPort');
