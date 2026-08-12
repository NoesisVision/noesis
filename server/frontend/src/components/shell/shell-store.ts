// Every piece of shell state the user can nudge (theme, sidebar, right panel,
// current project) survives a reload under one `noesis.shell.*` namespace, so
// the whole shell can be reset by clearing that prefix. Storage may throw
// (private mode, disabled cookies) — the shell degrades to defaults instead of
// crashing on boot.
const PREFIX = 'noesis.shell.';

export function readShellState<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(PREFIX + key);
    return raw === null ? fallback : (JSON.parse(raw) as T);
  } catch {
    return fallback;
  }
}

export function writeShellState<T>(key: string, value: T): void {
  try {
    localStorage.setItem(PREFIX + key, JSON.stringify(value));
  } catch {
    // Nothing to do: persistence is a convenience, not a requirement.
  }
}

export function clearShellState(key: string): void {
  try {
    localStorage.removeItem(PREFIX + key);
  } catch {
    // See writeShellState.
  }
}
