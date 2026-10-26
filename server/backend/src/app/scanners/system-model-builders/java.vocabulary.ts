import type { BuildingBlockType } from '#backend/app/system-model/system-model';
import type {
  AnnotationRole,
  AnnotationVocabulary,
  PrimitiveName,
} from './vocabulary';

/*
 * The Java vocabulary: the `vision.noesis.annotations` library
 * (code-parsers/java/annotations) and the JDK's types, by the ids the Java
 * parser writes. Section 2 of docs/plans/code-model-to-system-model.md is
 * the reference; the Java column is this file.
 */

const ANNOTATIONS = 'T:vision.noesis.annotations';

const BUILDING_BLOCKS: Record<string, BuildingBlockType> = {
  [`${ANNOTATIONS}.AggregateRoot`]: 'aggregate',
  [`${ANNOTATIONS}.DomainEntity`]: 'entity',
  [`${ANNOTATIONS}.ValueObject`]: 'value_object',
  [`${ANNOTATIONS}.Identifier`]: 'value_object',
  [`${ANNOTATIONS}.DomainService`]: 'domain_service',
  [`${ANNOTATIONS}.ApplicationService`]: 'application_service',
  [`${ANNOTATIONS}.Repository`]: 'repository',
  [`${ANNOTATIONS}.Factory`]: 'factory',
  [`${ANNOTATIONS}.ExternalIntegration`]: 'external_integration',
  // An adapter is the code's side of an external integration.
  [`${ANNOTATIONS}.Adapter`]: 'external_integration',
  // Messages: the model has no message types, so they are value objects.
  [`${ANNOTATIONS}.Command`]: 'value_object',
  [`${ANNOTATIONS}.Query`]: 'value_object',
  [`${ANNOTATIONS}.Event`]: 'value_object',
};

const ROLES = new Map<string, AnnotationRole>([
  ...Object.entries(BUILDING_BLOCKS).map(
    ([id, type]): [string, AnnotationRole] => [
      id,
      { role: 'buildingBlock', type },
    ],
  ),
  // The handler annotations carry no argument: the annotation itself fixes the type.
  [`${ANNOTATIONS}.CommandHandler`, { role: 'behaviour', type: 'Command' }],
  [`${ANNOTATIONS}.QueryHandler`, { role: 'behaviour', type: 'Query' }],
  [`${ANNOTATIONS}.EventHandler`, { role: 'behaviour', type: 'Event' }],
  // `Module` is a package annotation: no namespace-wide annotations yet (section 12).
]);

const LANG = 'T:java.lang';
const TIME = 'T:java.time';

const PRIMITIVES = new Map<string, PrimitiveName>([
  // `PrimitiveTypeRef.name`: the eight keywords.
  ['boolean', 'boolean'],
  ['byte', 'integer'],
  ['short', 'integer'],
  ['int', 'integer'],
  ['long', 'integer'],
  ['char', 'string'],
  ['float', 'decimal'],
  ['double', 'decimal'],
  // Platform types, by id; a box is a platform type, never the keyword.
  [`${LANG}.String`, 'string'],
  [`${LANG}.CharSequence`, 'string'],
  [`${LANG}.Character`, 'string'],
  [`${LANG}.Boolean`, 'boolean'],
  [`${LANG}.Byte`, 'integer'],
  [`${LANG}.Short`, 'integer'],
  [`${LANG}.Integer`, 'integer'],
  [`${LANG}.Long`, 'integer'],
  ['T:java.math.BigInteger', 'integer'],
  [`${LANG}.Float`, 'decimal'],
  [`${LANG}.Double`, 'decimal'],
  ['T:java.math.BigDecimal', 'decimal'],
  ['T:java.util.UUID', 'uuid'],
  [`${TIME}.LocalDate`, 'date'],
  [`${TIME}.Instant`, 'datetime'],
  [`${TIME}.LocalDateTime`, 'datetime'],
  [`${TIME}.ZonedDateTime`, 'datetime'],
  [`${TIME}.OffsetDateTime`, 'datetime'],
  ['T:java.util.Date', 'datetime'],
  [`${TIME}.Duration`, 'duration'],
  [`${TIME}.Period`, 'duration'],
]);

const UTIL = 'T:java.util';

const COLLECTIONS = new Set([
  `${LANG}.Iterable\`1`,
  `${UTIL}.Collection\`1`,
  `${UTIL}.List\`1`,
  `${UTIL}.Set\`1`,
  `${UTIL}.SortedSet\`1`,
  `${UTIL}.NavigableSet\`1`,
  `${UTIL}.Queue\`1`,
  `${UTIL}.Deque\`1`,
  `${UTIL}.ArrayList\`1`,
  `${UTIL}.LinkedList\`1`,
  `${UTIL}.HashSet\`1`,
  `${UTIL}.LinkedHashSet\`1`,
  `${UTIL}.TreeSet\`1`,
  `${UTIL}.ArrayDeque\`1`,
  `${UTIL}.stream.Stream\`1`,
]);

const DICTIONARIES = new Set([
  `${UTIL}.Map\`2`,
  `${UTIL}.SortedMap\`2`,
  `${UTIL}.NavigableMap\`2`,
  `${UTIL}.HashMap\`2`,
  `${UTIL}.LinkedHashMap\`2`,
  `${UTIL}.TreeMap\`2`,
  `${UTIL}.concurrent.ConcurrentMap\`2`,
]);

const CONCURRENT = `${UTIL}.concurrent`;

/** Members every object has, or that records and comparison bring. */
const TECHNICAL_MEMBERS = new Set([
  'equals',
  'hashCode',
  'toString',
  'clone',
  'finalize',
  'compareTo',
  'getClass',
  'wait',
  'notify',
  'notifyAll',
]);

export const JAVA_VOCABULARY: AnnotationVocabulary = {
  language: 'java',
  roles: ROLES,
  // No Java annotation carries these arguments today; the names are what a future one would use.
  arguments: {
    name: 'name',
    description: 'description',
    triggeredBy: 'triggeredBy',
  },
  primitives: PRIMITIVES,
  collections: COLLECTIONS,
  dictionaries: DICTIONARIES,
  wrappers: new Set([
    `${CONCURRENT}.CompletableFuture\`1`,
    `${CONCURRENT}.CompletionStage\`1`,
    `${CONCURRENT}.Future\`1`,
  ]),
  optionalWrappers: new Set([`${UTIL}.Optional\`1`]),
  voidTypes: new Set([`${LANG}.Void`]),
  technicalMembers: TECHNICAL_MEMBERS,
};
