import { afterAll, beforeEach, describe, expect, it } from 'bun:test';
import {
  type DiagramStep,
  recallSteps,
  rememberSteps,
} from '../src/features/system-model/ui/exploration/exploration-steps';

/** The machine's storage, as a page has it, for the steps to be kept in. */
class MemoryStorage {
  private readonly items = new Map<string, string>();
  get length() {
    return this.items.size;
  }
  key(index: number) {
    return [...this.items.keys()][index] ?? null;
  }
  getItem(key: string) {
    return this.items.get(key) ?? null;
  }
  setItem(key: string, value: string) {
    this.items.set(key, value);
  }
  removeItem(key: string) {
    this.items.delete(key);
  }
}

const hadWindow = 'window' in globalThis;
const before: unknown = Reflect.get(globalThis, 'window');
let storage = new MemoryStorage();
beforeEach(() => {
  storage = new MemoryStorage();
  Reflect.set(globalThis, 'window', { localStorage: storage });
});
afterAll(() => {
  if (hadWindow) Reflect.set(globalThis, 'window', before);
  else Reflect.deleteProperty(globalThis, 'window');
});

const MODEL = '01a15509-0909-725f-8ab8-25ab23fc10d3';
const KEY = `noesis.systemModel.exploration.steps.${MODEL}`;

const step = (slots: DiagramStep['slots']): DiagramStep => ({
  choice: { shown: new Set(), picks: { added: new Set(), removed: new Set() } },
  relations: new Set(['contains', 'state', 'input']),
  direction: 'vertical',
  slots,
  nodes: [],
});

describe('the steps the diagram took, kept on the machine', () => {
  it('keeps where each step drew its slots', () => {
    rememberSteps(MODEL, { list: [step('nodes'), step('cards')], at: 1 });
    const recalled = recallSteps(MODEL);
    expect(recalled?.list.map(({ slots }) => slots)).toEqual([
      'nodes',
      'cards',
    ]);
    expect(recalled?.at).toBe(1);
  });

  it('opens a step saved before slots could be on cards as it was drawn, as nodes', () => {
    storage.setItem(
      KEY,
      JSON.stringify({
        v: 1,
        savedAt: 1,
        at: 0,
        list: [
          {
            added: [],
            removed: [],
            relations: ['contains', 'state'],
            direction: 'horizontal',
            nodes: [],
          },
        ],
      }),
    );
    expect(recallSteps(MODEL)?.list[0]).toMatchObject({
      slots: 'nodes',
      direction: 'horizontal',
    });
  });

  it('forgets steps that say slots are drawn somewhere it does not know', () => {
    rememberSteps(MODEL, { list: [step('cards')], at: 0 });
    const kept = JSON.parse(storage.getItem(KEY) ?? '{}') as {
      list: Record<string, unknown>[];
    };
    kept.list[0]!.slots = 'beside';
    storage.setItem(KEY, JSON.stringify(kept));
    expect(recallSteps(MODEL)).toBeNull();
  });
});
