import type { DesignDocument } from '#backend/app/design-docs/model/design-doc';
import type { ElementRef } from '#backend/app/design-docs/model/design-doc-ref';

export const elementRef = (id: string): ElementRef => ({ kind: 'element', id });

export const slotRef = (ownerId: string, ...path: string[]): ElementRef => ({
  kind: 'slot',
  ownerId,
  path,
});

export type ModelPath = readonly (string | number)[];

type Unknown = Record<string, unknown>;

const isRecord = (value: unknown): value is Unknown =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const idOf = (value: unknown): string | null =>
  isRecord(value) && typeof value.id === 'string' && value.id !== ''
    ? value.id
    : null;

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
 * Rebuilt per call; callers resolving many refs should build it once and pass
 * it in. A duplicate id resolves to the first in document order.
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
 * An element ref where the target has an id, else a slot on the nearest
 * ancestor that does. `null` for members of id-less lists (a Gherkin tag, an
 * examples cell).
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

export function resolveRef(
  document: DesignDocument,
  ref: ElementRef,
  index?: Map<string, ModelPath>,
): unknown {
  const path = modelPathForRef(document, ref, index);
  return path === null ? undefined : valueAtModelPath(document, path);
}
