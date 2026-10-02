import type { ReactElement } from 'react';
import { Tooltip } from '#/shared/design-system/tooltip.tsx';

/**
 * A reference split into its optional name and its type, the type read by
 * its qualified name's last segment:
 * - `string` → `{ type: 'string' }`
 * - `name: string` → `{ name: 'name', type: 'string' }`
 * - `name: a.b.C` → `{ name: 'name', type: 'C' }`
 */
export const shortName = (ref: string): { type: string; name?: string } => {
  const colon = ref.indexOf(':');
  const qualified = ref.slice(colon + 1).trim();
  const type = qualified.slice(qualified.lastIndexOf('.') + 1);
  return colon === -1 ? { type } : { type, name: ref.slice(0, colon).trim() };
};

/** A reference as read: `name: a.b.C` reads as `name: C`. */
export const shortLabel = (ref: string): string => {
  const { type, name } = shortName(ref);
  return name ? `${name}: ${type}` : type;
};

/**
 * A qualified name — `a.b.C` or `name: a.b.C` — read by its last segment, as
 * the tree names it, with the whole on hover. A name with nothing to cut
 * reads as it is, with no tooltip to repeat it.
 *
 * `render` draws the short label, for a caller that needs it in an element of
 * its own — a button, a styled code span; the tooltip wraps that element, so
 * it must take a ref.
 */
export function QualifiedName({
  name,
  render = (short) => <span>{short}</span>,
}: {
  name: string;
  render?: (short: string) => ReactElement;
}) {
  const short = shortLabel(name);
  const label = render(short);
  return short === name.trim() ? (
    label
  ) : (
    <Tooltip openDelay={300} label={name} position="right">
      {label}
    </Tooltip>
  );
}
