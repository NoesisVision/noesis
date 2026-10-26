import type { Clock } from '#backend/app/clock';

/** A clock stopped at `instant`; its day is the instant's UTC date. */
export function fixedClock(instant: string): Clock {
  return { now: () => instant, today: () => instant.slice(0, 10) };
}
