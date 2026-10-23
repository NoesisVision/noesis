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

/** The swatch's Mantine colour, derived from the id; it is deliberately not stored. */
export function changeSwatchColor(id: string): (typeof SWATCH_COLORS)[number] {
  let hash = 0;
  for (const char of id) {
    hash = (hash * 31 + char.charCodeAt(0)) % SWATCH_HASH_MODULUS;
  }
  return SWATCH_COLORS[hash % SWATCH_COLORS.length] ?? SWATCH_COLORS[0];
}

/** The swatch as a CSS colour. */
export function changeSwatch(id: string): string {
  return `var(--mantine-color-${changeSwatchColor(id)}-6)`;
}

/** What a change's tile reads: the first letters of its first two words. */
export function changeInitials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((word) => word[0]?.toUpperCase())
    .join('');
}

/** The stages a change goes through, in order: what its progress is drawn from. */
export const CHANGE_STAGES = Object.keys(CHANGE_STATUS_META) as ChangeStatus[];
