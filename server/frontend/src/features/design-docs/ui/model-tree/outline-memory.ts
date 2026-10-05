/*
 * The shape a reader left a tree in, kept for as long as they are here. The
 * session rather than the machine: the set names paths in one document, and a
 * design document is rewritten by the agent often enough that a set saved for
 * good would outlive the elements it names. Coming back to a view within the
 * tab — which is what the reader actually does — is covered either way.
 */

export interface ExpansionMemory {
  /** What was left open, or null if nothing was. */
  readonly recall: () => Set<string> | null;
  readonly remember: (paths: ReadonlySet<string>) => void;
}

/** Remembers nothing, for a tree that is not worth keeping a place in. */
export const FORGETFUL: ExpansionMemory = {
  recall: () => null,
  remember: () => {},
};

export function expansionMemory(key: string): ExpansionMemory {
  return {
    recall: () => {
      const paths = readPaths(key);
      return paths === null ? null : new Set(paths);
    },
    remember: (paths) => {
      try {
        window.sessionStorage.setItem(key, JSON.stringify([...paths]));
      } catch {
        // Storage may be unavailable (private mode, quota); the tree still works.
      }
    },
  };
}

/** The one throwing call, kept to itself: unreadable is the same as absent. */
function readPaths(key: string): string[] | null {
  try {
    const stored = window.sessionStorage.getItem(key);
    if (stored === null) return null;
    const parsed: unknown = JSON.parse(stored);
    return Array.isArray(parsed) && parsed.every((p) => typeof p === 'string')
      ? parsed
      : null;
  } catch {
    return null;
  }
}
