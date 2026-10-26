import type { BuildingBlockType } from '#backend/app/system-model/system-model';
import type {
  AnnotationRole,
  AnnotationVocabulary,
  PrimitiveName,
} from './vocabulary';

/*
 * The C# vocabulary: the `NoesisVision.Annotations` package
 * (https://github.com/NoesisVision/noesis-dotnet-annotations) and the .NET
 * platform types, by the ids the Roslyn parser writes. Section 2 of
 * docs/plans/code-model-to-system-model.md is the reference.
 */

const ANNOTATIONS = 'T:NoesisVision.Annotations';
const DOMAIN = `${ANNOTATIONS}.Domain`;
const DDD = `${DOMAIN}.DDD`;

const BUILDING_BLOCKS: Record<string, BuildingBlockType> = {
  [`${DDD}.DddAggregateAttribute`]: 'aggregate',
  [`${DDD}.DddEntityAttribute`]: 'entity',
  [`${DDD}.DddValueObjectAttribute`]: 'value_object',
  [`${DDD}.DddDomainServiceAttribute`]: 'domain_service',
  [`${DDD}.DddApplicationServiceAttribute`]: 'application_service',
  [`${DDD}.DddRepositoryAttribute`]: 'repository',
  [`${DDD}.DddFactoryAttribute`]: 'factory',
  [`${DOMAIN}.ExternalSystemIntegrationAttribute`]: 'external_integration',
  // Messages: the model has no message types, so they are value objects.
  [`${DOMAIN}.CommandAttribute`]: 'value_object',
  [`${DOMAIN}.QueryAttribute`]: 'value_object',
  [`${DOMAIN}.EventAttribute`]: 'value_object',
  [`${DDD}.DddDomainEventAttribute`]: 'value_object',
  [`${DOMAIN}.ReadModelAttribute`]: 'value_object',
};

const ROLES = new Map<string, AnnotationRole>([
  ...Object.entries(BUILDING_BLOCKS).map(
    ([id, type]): [string, AnnotationRole] => [
      id,
      { role: 'buildingBlock', type },
    ],
  ),
  [`${DOMAIN}.DomainBehaviorAttribute`, { role: 'behaviour' }],
  [`${DOMAIN}.EntryPointAttribute`, { role: 'behaviour' }],
  [`${ANNOTATIONS}.People.ActorAttribute`, { role: 'actor' }],
  [`${ANNOTATIONS}.ShortDescriptionAttribute`, { role: 'description' }],
  [`${DOMAIN}.ScenarioAttribute`, { role: 'scenario' }],
  [`${ANNOTATIONS}.ExcludeFromDocsAttribute`, { role: 'exclude' }],
]);

const PRIMITIVES = new Map<string, PrimitiveName>([
  // `PrimitiveTypeRef.name`: the C# keywords.
  ['bool', 'boolean'],
  ['byte', 'integer'],
  ['sbyte', 'integer'],
  ['short', 'integer'],
  ['ushort', 'integer'],
  ['int', 'integer'],
  ['uint', 'integer'],
  ['long', 'integer'],
  ['ulong', 'integer'],
  ['nint', 'integer'],
  ['nuint', 'integer'],
  ['float', 'decimal'],
  ['double', 'decimal'],
  ['decimal', 'decimal'],
  ['string', 'string'],
  ['char', 'string'],
  // Platform types, by id.
  ['T:System.Guid', 'uuid'],
  ['T:System.DateTime', 'datetime'],
  ['T:System.DateTimeOffset', 'datetime'],
  ['T:NodaTime.Instant', 'datetime'],
  ['T:NodaTime.ZonedDateTime', 'datetime'],
  ['T:NodaTime.LocalDateTime', 'datetime'],
  ['T:NodaTime.OffsetDateTime', 'datetime'],
  ['T:System.DateOnly', 'date'],
  ['T:NodaTime.LocalDate', 'date'],
  ['T:System.TimeSpan', 'duration'],
  ['T:NodaTime.Duration', 'duration'],
  ['T:NodaTime.Period', 'duration'],
]);

const GENERIC = 'T:System.Collections.Generic';
const IMMUTABLE = 'T:System.Collections.Immutable';

const COLLECTIONS = new Set([
  `${GENERIC}.IEnumerable\`1`,
  `${GENERIC}.ICollection\`1`,
  `${GENERIC}.IList\`1`,
  `${GENERIC}.IReadOnlyCollection\`1`,
  `${GENERIC}.IReadOnlyList\`1`,
  `${GENERIC}.ISet\`1`,
  `${GENERIC}.IReadOnlySet\`1`,
  `${GENERIC}.List\`1`,
  `${GENERIC}.HashSet\`1`,
  `${GENERIC}.SortedSet\`1`,
  `${GENERIC}.Queue\`1`,
  `${GENERIC}.Stack\`1`,
  `${GENERIC}.LinkedList\`1`,
  `${GENERIC}.IAsyncEnumerable\`1`,
  'T:System.Linq.IQueryable`1',
  `${IMMUTABLE}.ImmutableArray\`1`,
  `${IMMUTABLE}.ImmutableList\`1`,
  `${IMMUTABLE}.IImmutableList\`1`,
  `${IMMUTABLE}.ImmutableHashSet\`1`,
  `${IMMUTABLE}.IImmutableSet\`1`,
  'T:System.Span`1',
  'T:System.ReadOnlySpan`1',
  'T:System.Memory`1',
  'T:System.ReadOnlyMemory`1',
]);

const DICTIONARIES = new Set([
  `${GENERIC}.IDictionary\`2`,
  `${GENERIC}.IReadOnlyDictionary\`2`,
  `${GENERIC}.Dictionary\`2`,
  `${IMMUTABLE}.ImmutableDictionary\`2`,
  `${IMMUTABLE}.IImmutableDictionary\`2`,
]);

const TASKS = 'T:System.Threading.Tasks';

/** Members every object has, or that the compiler and records bring. */
const TECHNICAL_MEMBERS = new Set([
  'Equals',
  'GetHashCode',
  'GetType',
  'ToString',
  'Finalize',
  'MemberwiseClone',
  'Clone',
  'Deconstruct',
  'PrintMembers',
  'CompareTo',
]);

export const CSHARP_VOCABULARY: AnnotationVocabulary = {
  language: 'csharp',
  roles: ROLES,
  arguments: {
    name: 'name',
    description: 'markdownText',
    triggeredBy: 'TriggeredBy',
  },
  primitives: PRIMITIVES,
  collections: COLLECTIONS,
  dictionaries: DICTIONARIES,
  wrappers: new Set([`${TASKS}.Task\`1`, `${TASKS}.ValueTask\`1`]),
  optionalWrappers: new Set(['T:System.Nullable`1']),
  voidTypes: new Set([`${TASKS}.Task`, `${TASKS}.ValueTask`]),
  technicalMembers: TECHNICAL_MEMBERS,
};
