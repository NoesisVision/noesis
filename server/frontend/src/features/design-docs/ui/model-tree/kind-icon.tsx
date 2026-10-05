import {
  IconActivity,
  IconAlertTriangle,
  IconAssembly,
  IconBlocks,
  IconCategory,
  IconChecklist,
  IconCircleCheck,
  IconCircleLetterC,
  IconCircleLetterE,
  IconCircleLetterQ,
  IconDatabase,
  IconDiamond,
  IconFolder,
  IconId,
  IconInfoCircle,
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
  IconTarget,
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
  group: IconCategory,
  need: IconTarget,
  check: IconChecklist,
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
  aggregate: IconPackageExport,
  entity: IconId,
  value_object: IconDiamond,
  domain_service: IconSettings,
  application_service: IconRoute,
  repository: IconDatabase,
  factory: IconAssembly,
  external_integration: IconWorld,
  Command: IconCircleLetterC,
  Event: IconCircleLetterE, // event handler
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
  Event: 'event',
  Query: 'query',
  Command: 'command',
};

/*
 * A check is no part of the model, so what it carries is no pattern of the
 * model's: it is what the check found, and it is drawn by that — a check that
 * found something and one that found nothing in tones of their own.
 */
const CHECK_ICONS = {
  warning: IconAlertTriangle,
  note: IconInfoCircle,
  pass: IconCircleCheck,
} as const;
type CheckLevel = keyof typeof CHECK_ICONS;

const CHECK_TONES: Partial<Record<CheckLevel, 'warning' | 'pass'>> = {
  warning: 'warning',
  pass: 'pass',
};

const isCheckLevel = (value: string): value is CheckLevel =>
  Object.hasOwn(CHECK_ICONS, value);

const isPattern = (value: string): value is Pattern =>
  (PATTERNS as readonly string[]).includes(value);

/*
 * The pattern first, since it says more than the kind does; the kind when
 * there is none, or none the model knows. A property's pattern is its type,
 * which only happens to share the vocabulary, so a property always reads as
 * a property.
 */
function drawingOf(kind: OutlineKind, pattern: string | null | undefined) {
  if (pattern != null) {
    if (kind === 'check' && isCheckLevel(pattern))
      return { Icon: CHECK_ICONS[pattern], tone: CHECK_TONES[pattern] };
    if (kind !== 'property' && isPattern(pattern))
      return { Icon: PATTERN_ICONS[pattern], tone: PATTERN_TONES[pattern] };
  }
  return { Icon: KIND_ICONS[kind], tone: undefined };
}

/** Decorative: the name beside it already says what the row is. */
export function KindIcon({
  kind,
  pattern,
}: {
  kind: OutlineKind;
  pattern: OutlineNode['pattern'] | undefined;
}) {
  const { Icon, tone } = drawingOf(kind, pattern);
  return (
    <Icon
      size={20}
      stroke={2}
      className={classes.icon}
      data-tone={tone}
      aria-hidden
    />
  );
}
