import {
  IconActivity,
  IconAssembly,
  IconBlocks,
  IconBolt,
  IconCircleLetterC,
  IconCircleLetterE,
  IconCircleLetterQ,
  IconDatabase,
  IconDiamond,
  IconFolder,
  IconId,
  IconListCheck,
  IconMathFunction,
  IconPackageExport,
  IconPoint,
  IconRoute,
  IconScale,
  IconSettings,
  IconShield,
  IconSitemap,
  IconStatusChange,
  IconWorld,
} from '@tabler/icons-react';
import type { OutlineKind, OutlineNode } from './model-outline.ts';
import classes from './model-tree.module.css';

const KIND_ICONS = {
  module: IconFolder,
  building_block: IconBlocks,
  behaviour: IconActivity,
  property: IconPoint,
  rule: IconScale,
  scenario: IconListCheck,
} as const satisfies Record<OutlineKind, unknown>;

/** Every pattern the model knows, spelled as the model spells it. */
const PATTERNS = [
  // building blocks
  'aggregate',
  'entity',
  'value_object',
  'domain_event',
  'domain_command',
  'domain_query',
  'domain_service',
  'application_service',
  'repository',
  'factory',
  'external_integration',
  // behaviours
  'Command',
  'Event',
  'Query',
  // rules
  'Consistency',
  'Structure',
  'Computation',
  'State change',
] as const;
type Pattern = (typeof PATTERNS)[number];

const PATTERN_ICONS = {
  aggregate: IconPackageExport,
  entity: IconId,
  value_object: IconDiamond,
  domain_event: IconCircleLetterE,
  domain_command: IconCircleLetterC,
  domain_query: IconCircleLetterQ,
  domain_service: IconSettings,
  application_service: IconRoute,
  repository: IconDatabase,
  factory: IconAssembly,
  external_integration: IconWorld,
  Command: IconCircleLetterC,
  Event: IconBolt, // event handler
  Query: IconCircleLetterQ,
  Consistency: IconShield,
  Structure: IconSitemap,
  Computation: IconMathFunction,
  'State change': IconStatusChange,
} as const satisfies Record<Pattern, unknown>;

/*
 * The three kinds of message, told apart at a glance: what happened, what is
 * asked, what is ordered. The colour is the stylesheet's, keyed by this, so
 * the rules for the selected row and the way down to it still win over it.
 */
const PATTERN_TONES: Partial<Record<Pattern, 'event' | 'query' | 'command'>> = {
  domain_event: 'event',
  Event: 'event',
  domain_query: 'query',
  Query: 'query',
  domain_command: 'command',
  Command: 'command',
};

const isPattern = (value: string): value is Pattern =>
  (PATTERNS as readonly string[]).includes(value);

/** Decorative: the name beside it already says what the row is. */
export function KindIcon({
  kind,
  pattern,
}: {
  kind: OutlineKind;
  pattern: OutlineNode['pattern'] | undefined;
}) {
  /* The pattern first, since it says more than the kind does; the kind when
     there is none, or none the model knows. A property's pattern is its type,
     which only happens to share the vocabulary, so a property always reads as
     a property. */
  const known =
    kind !== 'property' && pattern != null && isPattern(pattern)
      ? pattern
      : null;
  const Icon = known === null ? KIND_ICONS[kind] : PATTERN_ICONS[known];
  return (
    <Icon
      size={20}
      stroke={2}
      className={classes.icon}
      data-tone={known === null ? undefined : PATTERN_TONES[known]}
      aria-hidden
    />
  );
}
