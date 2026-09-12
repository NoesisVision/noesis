const KEY = 'noesis.shell.lastChangeId';

/** The change the user last opened; `/` lands there and the documentation views keep it in the picker. */
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
