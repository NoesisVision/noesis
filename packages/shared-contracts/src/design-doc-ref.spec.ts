import { describe, expect, it } from 'bun:test';
import { designDocFixture } from './design-doc.fixture.js';
import {
  ElementRefSchema,
  elementIndex,
  elementRef,
  type ModelPath,
  modelPathForRef,
  refForModelPath,
  resolveRef,
  slotRef,
  valueAtModelPath,
} from './design-doc-ref.js';

const doc = designDocFixture;

describe('ElementRefSchema', () => {
  it('accepts the two shapes and rejects anything else', () => {
    expect(
      ElementRefSchema.safeParse({ kind: 'element', id: 'uc-book' }).success,
    ).toBe(true);
    expect(
      ElementRefSchema.safeParse({
        kind: 'slot',
        ownerId: 'uc-book',
        path: ['input', 'fields'],
      }).success,
    ).toBe(true);

    // A slot with no path names nothing the owner does not already name.
    expect(
      ElementRefSchema.safeParse({ kind: 'slot', ownerId: 'uc-book', path: [] })
        .success,
    ).toBe(false);
    expect(ElementRefSchema.safeParse({ kind: 'element' }).success).toBe(false);
    expect(ElementRefSchema.safeParse({ id: 'uc-book' }).success).toBe(false);
  });
});

describe('elementIndex', () => {
  it('finds every id, at every depth', () => {
    const index = elementIndex(doc);

    expect(index.get(doc.id)).toEqual([]);
    expect(index.get('act-payments')).toEqual(['actors', 1]);
    expect(index.get('rule-hold')).toEqual(['useCases', 0, 'rules', 0]);
    expect(index.get('prop-expires')).toEqual([
      'buildingBlocks',
      1,
      'properties',
      1,
    ]);
    expect(index.get('row-2')).toEqual([
      'useCases',
      0,
      'acceptanceScenarios',
      1,
      'examples',
      'rows',
      1,
    ]);
    expect(index.has('nope')).toBe(false);
  });

  it('does not index the baseline snapshots, which hold no ids', () => {
    // `baseline.comparable` mirrors a use case's fields but is not an element.
    for (const path of elementIndex(doc).values()) {
      expect(path).not.toContain('comparable');
    }
  });
});

describe('refForModelPath', () => {
  it('names anything carrying an id by that id alone', () => {
    expect(refForModelPath(doc, ['useCases', 0])).toEqual(
      elementRef('uc-book'),
    );
    expect(refForModelPath(doc, ['useCases', 0, 'rules', 0])).toEqual(
      elementRef('rule-hold'),
    );
    expect(
      refForModelPath(doc, [
        'useCases',
        0,
        'acceptanceScenarios',
        0,
        'steps',
        1,
      ]),
    ).toEqual(elementRef('st-2'));
    expect(refForModelPath(doc, [])).toEqual(elementRef(doc.id));
  });

  it('falls back to a slot on the nearest owner for a place with no element', () => {
    expect(refForModelPath(doc, ['goal'])).toEqual(slotRef(doc.id, 'goal'));
    expect(refForModelPath(doc, ['useCases', 0, 'output', 'summary'])).toEqual(
      slotRef('uc-book', 'output', 'summary'),
    );
    // A list is a place, not an element: this is the insertion point.
    expect(refForModelPath(doc, ['useCases', 0, 'input', 'fields'])).toEqual(
      slotRef('uc-book', 'input', 'fields'),
    );
    expect(refForModelPath(doc, ['actors'])).toEqual(slotRef(doc.id, 'actors'));
  });

  it('has no ref for a member of a list whose members have no ids', () => {
    expect(
      refForModelPath(doc, [
        'useCases',
        0,
        'acceptanceScenarios',
        0,
        'tags',
        0,
      ]),
    ).toBeNull();
    expect(
      refForModelPath(doc, [
        'useCases',
        0,
        'acceptanceScenarios',
        1,
        'examples',
        'rows',
        0,
        'cells',
        1,
      ]),
    ).toBeNull();
  });

  it('has no ref for a path that is not in the document', () => {
    expect(refForModelPath(doc, ['useCases', 9])).toBeNull();
    expect(refForModelPath(doc, ['nope'])).toBeNull();
  });
});

describe('resolveRef', () => {
  it('finds an element without knowing where it sits', () => {
    // One call shape reaches four different depths.
    expect(resolveRef(doc, elementRef('rule-deposit'))).toBe(
      doc.useCases[0]?.rules[1],
    );
    expect(resolveRef(doc, elementRef('st-5'))).toBe(
      doc.useCases[0]?.acceptanceScenarios[1]?.steps[0],
    );
    expect(resolveRef(doc, elementRef('prop-expires'))).toBe(
      doc.buildingBlocks[1]?.properties[1],
    );
    expect(resolveRef(doc, elementRef('b-hold-place'))).toBe(doc.behaviours[1]);
    expect(resolveRef(doc, elementRef(doc.id))).toBe(doc);
  });

  it('finds a slot', () => {
    expect(resolveRef(doc, slotRef(doc.id, 'goal'))).toBe(doc.goal);
    expect(resolveRef(doc, slotRef('uc-book', 'rules'))).toBe(
      doc.useCases[0]?.rules,
    );
    expect(resolveRef(doc, slotRef('as-book-declined', 'examples'))).toBe(
      doc.useCases[0]?.acceptanceScenarios[1]?.examples,
    );
  });

  it('returns undefined rather than throwing on a stale ref', () => {
    expect(resolveRef(doc, elementRef('nope'))).toBeUndefined();
    expect(resolveRef(doc, slotRef('nope', 'rules'))).toBeUndefined();
    expect(resolveRef(doc, slotRef('uc-book', 'notAField'))).toBeUndefined();
  });

  it('accepts a prebuilt index, for resolving many refs at once', () => {
    const index = elementIndex(doc);
    expect(resolveRef(doc, elementRef('rule-hold'), index)).toBe(
      doc.useCases[0]?.rules[0],
    );
  });
});

describe('ref ↔ model path', () => {
  function* everyPath(value: unknown, path: ModelPath): Generator<ModelPath> {
    yield path;
    if (Array.isArray(value)) {
      for (const [index, item] of value.entries()) {
        yield* everyPath(item, [...path, index]);
      }
    } else if (typeof value === 'object' && value !== null) {
      for (const [key, item] of Object.entries(value)) {
        yield* everyPath(item, [...path, key]);
      }
    }
  }

  const paths = [...everyPath(doc, [])];
  const addressable = paths.filter(
    (path) => refForModelPath(doc, path) !== null,
  );

  it('covers the whole fixture', () => {
    // A guard on the guard: if the walk stops finding anything, the round-trip
    // below would pass vacuously.
    expect(paths.length).toBeGreaterThan(200);
    expect(addressable.length).toBeGreaterThan(100);
  });

  it('round-trips every addressable path', () => {
    for (const path of addressable) {
      const ref = refForModelPath(doc, path);
      expect(ref).not.toBeNull();
      expect({
        path,
        back: modelPathForRef(doc, ref ?? elementRef('')),
      }).toEqual({
        path,
        back: path,
      });
    }
  });

  it('resolves every addressable path to the value that is actually there', () => {
    for (const path of addressable) {
      const ref = refForModelPath(doc, path);
      expect(resolveRef(doc, ref ?? elementRef(''))).toBe(
        valueAtModelPath(doc, path) as never,
      );
    }
  });
});

describe('what a ref survives', () => {
  it('holds when its element is reordered, and when its parent is', () => {
    const moved = structuredClone(doc);
    moved.useCases[0]?.rules.reverse();
    moved.useCases.reverse();

    expect(resolveRef(moved, elementRef('rule-hold'))).toEqual(
      resolveRef(doc, elementRef('rule-hold')) as never,
    );
  });

  it('holds when its element is renamed', () => {
    const renamed = structuredClone(doc);
    const useCase = renamed.useCases[0];
    if (useCase) useCase.name = 'Reserve appointment';

    expect(
      (resolveRef(renamed, elementRef('uc-book')) as { name: string }).name,
    ).toBe('Reserve appointment');
  });

  it('holds when a scenario moves to another use case', () => {
    const moved = structuredClone(doc);
    const [first, second] = moved.useCases;
    const scenario = first?.acceptanceScenarios.shift();
    if (second && scenario) second.acceptanceScenarios.push(scenario);

    expect(modelPathForRef(moved, elementRef('as-book-happy'))).toEqual([
      'useCases',
      1,
      'acceptanceScenarios',
      0,
    ]);
  });

  it('stops resolving once the element is deleted', () => {
    const without = structuredClone(doc);
    const useCase = without.useCases[0];
    if (useCase) useCase.rules = [];

    expect(resolveRef(without, elementRef('rule-hold'))).toBeUndefined();
    expect(modelPathForRef(without, elementRef('rule-hold'))).toBeNull();
  });
});
