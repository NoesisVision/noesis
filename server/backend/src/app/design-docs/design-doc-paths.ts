import type { DesignDocument } from '#backend/app/design-docs/model/design-doc';
import type { ElementRef } from '#backend/app/design-docs/model/design-doc-ref';

/*
 * Resolving element refs against a design document.
 *
 * The model is normalised and related by id, so an address is an id — nothing
 * more (see `ElementRefSchema` in the contracts). Resolution goes through
 * `elementIndex`, one walk producing every id in the document. That is what
 * makes ids document-wide unique a hard requirement rather than a nicety;
 * `design-doc-integrity.ts` enforces it.
 *
 * This lives beside the integrity check, not in the contracts package: the
 * contracts are declarative shapes the agent reads, and these are the
 * functions the service runs over them.
 */

export const elementRef = (id: string): ElementRef => ({ kind: 'element', id });

export const slotRef = (ownerId: string, ...path: string[]): ElementRef => ({
  kind: 'slot',
  ownerId,
  path,
});

/** A concrete location in the document object, as property keys and indices. */
export type ModelPath = readonly (string | number)[];

type Unknown = Record<string, unknown>;

const isRecord = (value: unknown): value is Unknown =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const idOf = (value: unknown): string | null =>
  isRecord(value) && typeof value.id === 'string' && value.id !== ''
    ? value.id
    : null;

/** Read the value at a model path, or `undefined` if the path does not exist. */
export function valueAtModelPath(
  document: DesignDocument,
  path: ModelPath,
): unknown {
  let current: unknown = document;
  for (const key of path) {
    if (Array.isArray(current) && typeof key === 'number') {
      current = current[key];
    } else if (isRecord(current) && typeof key === 'string') {
      current = current[key];
    } else {
      return undefined;
    }
    if (current === undefined) return undefined;
  }
  return current;
}

/**
 * Every id in the document, mapped to where it currently sits.
 *
 * Rebuilt per call. Callers resolving many refs at once should build it once
 * and pass it in. A duplicate id resolves to whichever came first in document
 * order — the integrity check reports the collision rather than this silently
 * picking a winner.
 */
export function elementIndex(document: DesignDocument): Map<string, ModelPath> {
  const index = new Map<string, ModelPath>();

  const walk = (value: unknown, path: ModelPath): void => {
    if (Array.isArray(value)) {
      for (const [at, item] of value.entries()) walk(item, [...path, at]);
      return;
    }
    if (!isRecord(value)) return;
    const id = idOf(value);
    if (id !== null && !index.has(id)) index.set(id, path);
    for (const [key, item] of Object.entries(value)) walk(item, [...path, key]);
  };

  walk(document, []);
  return index;
}

/** Where a ref points, or `null` if nothing is there. */
export function modelPathForRef(
  document: DesignDocument,
  ref: ElementRef,
  index: Map<string, ModelPath> = elementIndex(document),
): ModelPath | null {
  if (ref.kind === 'element') return index.get(ref.id) ?? null;

  const owner = index.get(ref.ownerId);
  if (!owner) return null;
  const path = [...owner, ...ref.path];
  return valueAtModelPath(document, path) === undefined ? null : path;
}

/**
 * The ref for a model path — an element ref wherever the target carries an id,
 * and otherwise a slot on the nearest ancestor that does.
 *
 * Returns `null` for a position that cannot be addressed at all, which means a
 * member of a list whose members have no ids: a Gherkin tag, an examples cell.
 */
export function refForModelPath(
  document: DesignDocument,
  path: ModelPath,
): ElementRef | null {
  const value = valueAtModelPath(document, path);
  if (value === undefined) return null;

  const own = idOf(value);
  if (own !== null) return { kind: 'element', id: own };

  for (let cut = path.length - 1; cut >= 0; cut -= 1) {
    const ownerId =
      cut === 0
        ? idOf(document)
        : idOf(valueAtModelPath(document, path.slice(0, cut)));
    if (ownerId === null) continue;
    const rest = path.slice(cut);
    if (rest.some((key) => typeof key !== 'string')) return null;
    return { kind: 'slot', ownerId, path: rest as string[] };
  }
  return null;
}

/** The value a ref points at, or `undefined` if it resolves to nothing. */
export function resolveRef(
  document: DesignDocument,
  ref: ElementRef,
  index?: Map<string, ModelPath>,
): unknown {
  const path = modelPathForRef(document, ref, index);
  return path === null ? undefined : valueAtModelPath(document, path);
}
