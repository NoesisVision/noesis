import { CONTAINMENT_KINDS } from '#/features/design-docs/relations.ts';
import { recordOf } from '#/shared/collections.ts';
import { titleCase } from '#/shared/ui/title-case.ts';
import type { Relation } from '#backend/app/system-model/system-model.ts';

/*
 * The relations the explorer draws as edges, and everything read off them
 * as the module loads — their words, their reaches, the chains they make —
 * kept together so none is read before it exists.
 */

/** A relation's two ends, as `[source, target]`. */
export type Pair = [string, string];

/**
 * Each relation drawn as an edge, as the view knows it, keyed by how the
 * filter names it: the model's relations it reads, the word its edges carry,
 * and its two ways of reaching — from the source, and read back from the
 * target. Its label is its key, titled. Containment is drawn as cards inside
 * cards, never as an edge, and reads `CONTAINMENT`.
 */
const DRAWN = {
  state: [['has_state'], 'has state', 'hasState', 'stateOf'],
  input: [['has_input'], 'has input', 'hasInput', 'inputOf'],
  output: [['has_output'], 'has output', 'hasOutput', 'outputOf'],
  extends: [['extends'], 'extends', 'extends', 'extendedBy'],
  collaborator: [
    ['has_collaborator'],
    'works with',
    'worksWith',
    'collaboratorOf',
  ],
  invokes: [
    ['behavior_invokes_behavior', 'process_invokes_behavior'],
    'invokes',
    'invokes',
    'invokedBy',
  ],
  performs: [['performs'], 'performs', 'performs', 'performedBy'],
  ships: [['unit_contains_module'], 'ships', 'ships', 'shippedIn'],
  provides: [['library_contains_block'], 'provides', 'provides', 'providedBy'],
  places: [['layer_contains_block'], 'places', 'places', 'placedIn'],
  runs: [['container_contains_unit'], 'runs', 'runs', 'runsOn'],
} as const satisfies Record<
  string,
  readonly [
    models: readonly Relation['kind'][],
    word: string,
    reach: string,
    back: string,
  ]
>;

export type DrawnRelationKind = keyof typeof DRAWN;

/** One drawn relation, each field as narrow as its entry in `DRAWN`. */
type DrawnRelationEntry = {
  [Kind in DrawnRelationKind]: {
    kind: Kind;
    models: (typeof DRAWN)[Kind][0];
    label: string;
    word: (typeof DRAWN)[Kind][1];
    reach: (typeof DRAWN)[Kind][2];
    back: (typeof DRAWN)[Kind][3];
  };
}[DrawnRelationKind];

/** The drawn relations, in the order the filter lists them. */
/** The drawn relations' kinds, in the order the filter lists them. */
export const DRAWN_KINDS = Object.keys(DRAWN) as DrawnRelationKind[];

export const DRAWN_RELATIONS: readonly DrawnRelationEntry[] = DRAWN_KINDS.map(
  (kind): DrawnRelationEntry => {
    const [models, word, reach, back] = DRAWN[kind];
    return {
      kind,
      models,
      label: titleCase(kind),
      word,
      reach,
      back,
    } as DrawnRelationEntry;
  },
);

/** The model's relations that place an element inside another: what "Contains" and "Is part of" read. */
export const CONTAINMENT = CONTAINMENT_KINDS;

export type RelationKind = 'contains' | 'isPartOf' | DrawnRelationKind;

/** Every relation the view names. */
export const RELATIONS: readonly { kind: RelationKind; label: string }[] = [
  { kind: 'contains', label: 'Contains' },
  { kind: 'isPartOf', label: 'Is part of' },
  ...DRAWN_RELATIONS.map(({ kind, label }) => ({ kind, label })),
];

/** The word an edge of each drawn relation carries. */
export const RELATION_WORD: Record<DrawnRelationKind, string> = recordOf(
  DRAWN_KINDS,
  (kind) => DRAWN[kind][1],
);

export const DRAWN_OF_MODEL = new Map<string, DrawnRelationKind>(
  DRAWN_RELATIONS.flatMap(({ models, kind }) =>
    models.map((model): [string, DrawnRelationKind] => [model, kind]),
  ),
);

/** A drawn relation's id: its kind and its two ends. */
export const drawnIdOf = (kind: DrawnRelationKind, from: string, to: string) =>
  `${kind}:${from}->${to}`;

/** The ways one element reaches others, each read from its own side. */
export type Reach =
  | 'contains'
  | 'isPartOf'
  | DrawnRelationEntry['reach']
  | DrawnRelationEntry['back'];

export const REACHES: readonly Reach[] = [
  'contains',
  'isPartOf',
  ...DRAWN_RELATIONS.flatMap(({ reach, back }) => [reach, back]),
];

export type ChainReach = Exclude<Reach, 'contains' | 'isPartOf'>;

/** The ways a chain can be followed: the relations drawn as edges, either way. */
export const CHAIN_REACHES: readonly ChainReach[] = DRAWN_RELATIONS.flatMap(
  ({ reach, back }) => [reach, back],
);

export const RELATION_OF_REACH = new Map<ChainReach, DrawnRelationKind>(
  DRAWN_RELATIONS.flatMap(({ kind, reach, back }) => [
    [reach, kind],
    [back, kind],
  ]),
);
