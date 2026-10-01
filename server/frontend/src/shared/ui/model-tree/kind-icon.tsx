import {
  IconApps,
  IconArrowsExchange,
  IconBell,
  IconBolt,
  IconBoxMultiple,
  IconBuildingFactory2,
  IconCube,
  IconDatabase,
  IconDiamond,
  IconEqual,
  IconFolder,
  IconId,
  IconListCheck,
  IconMathFunction,
  IconPlug,
  IconPoint,
  IconScale,
  IconSend,
  IconSettings,
  IconSitemap,
  IconZoomQuestion,
} from '@tabler/icons-react';
import type { OutlineKind, OutlineNode } from './model-outline.ts';
import classes from './model-tree.module.css';

const KIND_ICONS = {
  module: IconFolder,
  building_block: IconCube,
  behaviour: IconBolt,
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
  aggregate: IconBoxMultiple,
  entity: IconId,
  value_object: IconDiamond,
  domain_service: IconSettings,
  application_service: IconApps,
  repository: IconDatabase,
  factory: IconBuildingFactory2,
  external_integration: IconPlug,
  Command: IconSend,
  Event: IconBell,
  Query: IconZoomQuestion,
  Consistency: IconEqual,
  Structure: IconSitemap,
  Computation: IconMathFunction,
  'State change': IconArrowsExchange,
} as const satisfies Record<Pattern, unknown>;

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
  const Icon =
    kind !== 'property' && pattern != null && isPattern(pattern)
      ? PATTERN_ICONS[pattern]
      : KIND_ICONS[kind];
  return <Icon size={16} stroke={1.6} className={classes.icon} aria-hidden />;
}
