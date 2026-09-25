import {
  IconBolt,
  IconCube,
  IconFolder,
  IconListCheck,
  IconPoint,
  IconScale,
} from '@tabler/icons-react';
import type { OutlineKind } from '#backend/ui/model-outline/model-outline.ts';
import classes from './model-tree.module.css';

const KIND_ICONS = {
  module: IconFolder,
  building_block: IconCube,
  behaviour: IconBolt,
  property: IconPoint,
  rule: IconScale,
  scenario: IconListCheck,
} as const satisfies Record<OutlineKind, unknown>;

/** Decorative: the name beside it already says what the row is. */
export function KindIcon({ kind }: { kind: OutlineKind }) {
  const Icon = KIND_ICONS[kind];
  return <Icon size={16} stroke={1.6} className={classes.icon} aria-hidden />;
}
