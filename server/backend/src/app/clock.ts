/** The time the service stamps and names its writes by. Injected, so specs pin it. */
export interface Clock {
  /** The ISO 8601 UTC instant a write is stamped with. */
  now(): string;
  /**
   * The ISO date a new entity's id starts with: the service's local calendar
   * date. The service runs beside the agent, so this is the day the writer
   * created the entity on.
   */
  today(): string;
}

export const systemClock: Clock = {
  now: () => new Date().toISOString(),
  today: () => {
    const now = new Date();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    return `${now.getFullYear()}-${month}-${day}`;
  },
};
