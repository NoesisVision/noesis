import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { expansionMemory, FORGETFUL } from '../src/shared/ui/outline-memory';

const KEY = 'noesis.designDocs.doc.expanded';
const memory = expansionMemory(KEY);

let store: Map<string, string>;
const had = Object.hasOwn(globalThis, 'window');

beforeEach(() => {
  store = new Map();
  Object.defineProperty(globalThis, 'window', {
    value: {
      sessionStorage: {
        getItem: (key: string) => store.get(key) ?? null,
        setItem: (key: string, value: string) => store.set(key, value),
      },
    },
    configurable: true,
    writable: true,
  });
});

afterEach(() => {
  if (!had) Reflect.deleteProperty(globalThis, 'window');
});

describe('expansionMemory', () => {
  it('has nothing to recall until something is remembered', () => {
    expect(memory.recall()).toBeNull();
  });

  it('gives back the set it was given', () => {
    memory.remember(new Set(['module|a', 'module|a.b']));
    expect([...(memory.recall() ?? [])].sort()).toEqual([
      'module|a',
      'module|a.b',
    ]);
  });

  it('remembers that everything was shut, which is not nothing', () => {
    memory.remember(new Set());
    expect(memory.recall()).toEqual(new Set());
  });

  it('treats what it cannot read as never written', () => {
    store.set(KEY, '{ not json');
    expect(memory.recall()).toBeNull();
    store.set(KEY, '{"open":true}');
    expect(memory.recall()).toBeNull();
    store.set(KEY, '["module|a", 7]');
    expect(memory.recall()).toBeNull();
  });

  it('carries on where there is nowhere to write', () => {
    Reflect.deleteProperty(globalThis, 'window');
    expect(() => memory.remember(new Set(['module|a']))).not.toThrow();
    expect(memory.recall()).toBeNull();
  });
});

describe('FORGETFUL', () => {
  it('keeps no place at all, and says so rather than failing', () => {
    expect(FORGETFUL.recall()).toBeNull();
    expect(() => FORGETFUL.remember(new Set(['module|a']))).not.toThrow();
  });
});
