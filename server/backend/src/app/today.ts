/** The ISO date a new entity's id starts with. Injected, so specs pin it. */
export type Today = () => string;

/**
 * The service's local calendar date. The service runs beside the agent, so
 * this is the day the writer created the entity on.
 */
export function localToday(): string {
  const now = new Date();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${now.getFullYear()}-${month}-${day}`;
}
