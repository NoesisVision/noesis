import {
  IconActivity,
  IconAdjustments,
  IconAlertTriangle,
  IconAssembly,
  IconBlocks,
  IconBooks,
  IconCategory,
  IconChecklist,
  IconChecks,
  IconCircleCheck,
  IconCircleLetterC,
  IconCircleLetterE,
  IconCircleLetterQ,
  IconDatabase,
  IconDiamond,
  IconFolder,
  IconHandClick,
  IconId,
  IconInfoCircle,
  IconListCheck,
  IconLogin2,
  IconLogout2,
  IconMathFunction,
  IconPackage,
  IconPackageExport,
  IconPoint,
  IconRoute,
  IconScale,
  IconServer,
  IconSettings,
  IconStack2,
  IconShield,
  IconSitemap,
  IconStatusChange,
  IconTool,
  IconTarget,
  IconUser,
  IconWorld,
} from '@tabler/icons-react';
import { BUILDING_BLOCK_KINDS } from '#/shared/model/building-block-kinds.ts';
import type { ElementKind } from '#backend/app/element-id.ts';
import type {
  BuildingBlockKind,
  RuleKind,
} from '#backend/app/system-model/system-model.ts';
import { RULE_KINDS } from '../../rules.ts';
import type { OutlineKind, OutlineNode } from './model-outline.ts';
import classes from './model-tree.module.css';

/** A row of the tree, or any element of the model a diagram draws. */
type IconKind = OutlineKind | ElementKind;

const KIND_ICONS = {
  module: IconFolder,
  actor: IconUser,
  manual_process: IconHandClick,
  building_block: IconBlocks,
  behavior: IconActivity,
  property: IconPoint,
  rule: IconScale,
  scenario: IconListCheck,
  group: IconCategory,
  need: IconTarget,
  check: IconChecklist,
  // Elements the tree does not hold yet, but a diagram draws.
  deployable_unit: IconPackage,
  library: IconBooks,
  layer: IconStack2,
  deployment_container: IconServer,
} as const satisfies Record<IconKind, unknown>;

/** Every pattern the model knows, spelled as the model spells it: a building block's kind, a rule's kind. */
const PATTERNS: readonly string[] = [...BUILDING_BLOCK_KINDS, ...RULE_KINDS];
type Pattern = BuildingBlockKind | RuleKind;

const PATTERN_ICONS = {
  aggregate: IconPackageExport,
  entity: IconId,
  value_object: IconDiamond,
  domain_service: IconSettings,
  application_service: IconRoute,
  repository: IconDatabase,
  factory: IconAssembly,
  external_integration: IconWorld,
  in_adapter: IconLogin2,
  out_adapter: IconLogout2,
  technical_service: IconTool,
  command: IconCircleLetterC,
  event: IconCircleLetterE,
  query: IconCircleLetterQ,
  validation: IconShield,
  state_change: IconStatusChange,
  post: IconChecks,
  computation: IconMathFunction,
  coordination: IconSitemap,
  configuration: IconAdjustments,
  // A kind the model gains fails here until it has an icon.
} as const satisfies Record<Pattern, unknown>;

/*
 * The three kinds of message, told apart at a glance: what happened, what is
 * asked, what is ordered. The colour is the stylesheet's, keyed by this, so
 * the rules for the selected row and the way down to it still win over it.
 */
const PATTERN_TONES: Partial<Record<Pattern, 'event' | 'query' | 'command'>> = {
  event: 'event',
  query: 'query',
  command: 'command',
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

const isPattern = (value: string): value is Pattern => PATTERNS.includes(value);

/*
 * The pattern first, since it says more than the kind does; the kind when
 * there is none, or none the model knows. A property's pattern is its type,
 * which only happens to share the vocabulary, so a property always reads as
 * a property.
 */
function drawingOf(kind: IconKind, pattern: string | null | undefined) {
  if (pattern != null) {
    if (kind === 'check' && isCheckLevel(pattern))
      return { Icon: CHECK_ICONS[pattern], tone: CHECK_TONES[pattern] };
    if (kind !== 'property' && isPattern(pattern))
      return { Icon: PATTERN_ICONS[pattern], tone: PATTERN_TONES[pattern] };
  }
  return { Icon: KIND_ICONS[kind], tone: undefined };
}

/** The icon a row of this kind and pattern is drawn with, for a list of its own. */
export const kindIconOf = (
  kind: OutlineKind,
  pattern: string | null | undefined,
) => drawingOf(kind, pattern).Icon;

/** Decorative: the name beside it already says what the row is. */
export function KindIcon({
  kind,
  pattern,
  size = 20,
}: {
  kind: IconKind;
  pattern: OutlineNode['pattern'] | undefined;
  size?: number;
}) {
  const { Icon, tone } = drawingOf(kind, pattern);
  return (
    <Icon
      size={size}
      stroke={2}
      className={classes.icon}
      data-tone={tone}
      aria-hidden
    />
  );
}
