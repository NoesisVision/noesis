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
 * the tree names it. Text alone, so it sits inside whatever element shows it;
 * what the whole name was is for a tooltip around that element to say.
 */
export function QualifiedName({ name }: { name: string }) {
  return <>{shortLabel(name)}</>;
}
