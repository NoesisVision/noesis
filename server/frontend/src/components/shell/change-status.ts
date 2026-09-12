import type { ChangeStatus, ChangeType } from '@repo/shared-contracts';

/** How each lifecycle status reads in the picker and future lists. */
export const CHANGE_STATUS_META: Record<
  ChangeStatus,
  { label: string; color: string }
> = {
  discovery: { label: 'Discovery', color: 'gray' },
  design: { label: 'Design', color: 'violet' },
  implementation: { label: 'Implementation', color: 'brand' },
  done: { label: 'Done', color: 'green' },
};

/** The type badge beside the key. */
export const CHANGE_TYPE_META: Record<
  ChangeType,
  { label: string; color: string }
> = {
  feature: { label: 'feature', color: 'green' },
  fix: { label: 'fix', color: 'red' },
  improvement: { label: 'improvement', color: 'teal' },
  chore: { label: 'chore', color: 'gray' },
};

const SWATCH_COLORS = [
  'blue',
  'grape',
  'teal',
  'orange',
  'pink',
  'cyan',
  'lime',
  'indigo',
  'violet',
  'yellow',
];

/** A stable swatch per change, hashed from its slug on the client; nothing is stored. */
export function changeSwatch(slug: string): string {
  let hash = 0;
  for (const char of slug) hash = (hash * 31 + char.charCodeAt(0)) | 0;
  const name = SWATCH_COLORS[Math.abs(hash) % SWATCH_COLORS.length];
  return `var(--mantine-color-${name}-6)`;
}
