import type { ChangeStatus, ChangeType } from '#backend/app/changes/change.ts';

export const CHANGE_STATUS_META: Record<
  ChangeStatus,
  { label: string; color: string }
> = {
  discovery: { label: 'Discovery', color: 'gray' },
  design: { label: 'Design', color: 'violet' },
  implementation: { label: 'Implementation', color: 'brand' },
  done: { label: 'Done', color: 'green' },
};

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
] as const;

/**
 * 2^31 - 1, prime: it keeps the rolling hash positive and far inside the safe
 * integer range without truncating it to 32 bits, which is what the 31
 * multiplier needs to go on mixing.
 */
const SWATCH_HASH_MODULUS = 2_147_483_647;

/** Derived from the slug; the colour is deliberately not stored. */
export function changeSwatch(slug: string): string {
  let hash = 0;
  for (const char of slug) {
    hash = (hash * 31 + char.charCodeAt(0)) % SWATCH_HASH_MODULUS;
  }
  const name = SWATCH_COLORS[hash % SWATCH_COLORS.length] ?? SWATCH_COLORS[0];
  return `var(--mantine-color-${name}-6)`;
}
