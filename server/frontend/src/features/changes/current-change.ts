import { useParams } from '@tanstack/react-router';

const KEY = 'noesis.shell.lastChangeId';

/**
 * Which change is open. Off a change route there is no parameter, so the last
 * opened one stands in and the change views keep working from
 * `/system-model`.
 */
export function useChangeId() {
  const { changeId } = useParams({ strict: false });
  return { changeId: changeId ?? readLastChange() ?? null };
}

export function readLastChange(): string | null {
  try {
    return window.localStorage.getItem(KEY);
  } catch {
    return null;
  }
}

export function writeLastChange(changeId: string): void {
  try {
    window.localStorage.setItem(KEY, changeId);
  } catch {
    // Storage may be unavailable (private mode, quota); the shell still works.
  }
}
