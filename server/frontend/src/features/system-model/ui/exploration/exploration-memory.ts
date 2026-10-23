import {
  type ElementChoice,
  NOTHING_CHOSEN,
} from '../../system-model-exploration.ts';

/*
 * What the reader chose to draw, kept on the machine with the diagram, so
 * a new tab or another day opens on it. A scan since may no longer find
 * some of it; the view leaves out what it does not find.
 */
const KEY = 'noesis.systemModel.exploration.elements';

interface Stored {
  shown: string[];
  added: string[];
  removed: string[];
}

export function recallChoice(): ElementChoice {
  const stored = readStored();
  if (stored === null) return NOTHING_CHOSEN;
  return {
    // Whole kinds are no longer drawn by choice, so none kept from before is.
    shown: new Set(),
    picks: { added: new Set(stored.added), removed: new Set(stored.removed) },
  };
}

export function rememberChoice({ shown, picks }: ElementChoice): void {
  const stored: Stored = {
    shown: [...shown],
    added: [...picks.added],
    removed: [...picks.removed],
  };
  try {
    window.localStorage.setItem(KEY, JSON.stringify(stored));
  } catch {
    // Storage may be unavailable (private mode, quota); the view still works.
  }
}

const isNames = (value: unknown): value is string[] =>
  Array.isArray(value) && value.every((each) => typeof each === 'string');

/** The one throwing call, kept to itself: unreadable is the same as absent. */
function readStored(): Stored | null {
  try {
    const stored = window.localStorage.getItem(KEY);
    if (stored === null) return null;
    const parsed: unknown = JSON.parse(stored);
    if (typeof parsed !== 'object' || parsed === null) return null;
    const shown: unknown = Reflect.get(parsed, 'shown');
    const added: unknown = Reflect.get(parsed, 'added');
    const removed: unknown = Reflect.get(parsed, 'removed');
    return isNames(shown) && isNames(added) && isNames(removed)
      ? { shown, added, removed }
      : null;
  } catch {
    return null;
  }
}
