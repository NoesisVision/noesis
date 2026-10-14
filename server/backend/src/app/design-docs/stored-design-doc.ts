import { z } from 'zod';
import { DesignDocument } from './design-doc';

/*
 * A design document as `.noesis/` keeps it. A scenario once had exactly one
 * `given`, one `when` and one `then`, each a field of its own; it now has its
 * steps, as one field. A document written the old way still reads: each of
 * its scenarios is given the steps its three fields spell, in that order, an
 * empty one left out. It is written back the new way the next time it is
 * saved.
 */

const LEGACY_STEPS = ['given', 'when', 'then'] as const;

type LegacyField =
  | { changed: false }
  | { changed?: true; value: string; author?: 'agent' | 'human' };

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const isWritten = (
  field: LegacyField,
): field is Extract<LegacyField, { value: string }> => 'value' in field;

/**
 * A scenario written the old way, as one with steps. Its three fields become
 * one only when all three say something, or all three are left as the model
 * has them: steps written in part would lose the part kept, so such a
 * scenario is left for validation to refuse.
 */
function upgradeScenario(scenario: unknown): unknown {
  if (!isRecord(scenario) || 'steps' in scenario) return scenario;
  if (!LEGACY_STEPS.some((kind) => kind in scenario)) return scenario;
  const fields = LEGACY_STEPS.map(
    (kind) => (scenario[kind] ?? { changed: false }) as LegacyField,
  );
  const rest = Object.fromEntries(
    Object.entries(scenario).filter(
      ([key]) => !(LEGACY_STEPS as readonly string[]).includes(key),
    ),
  );
  if (fields.every((field) => !isWritten(field))) return rest;
  if (!fields.every(isWritten)) return scenario;
  const written = fields as Extract<LegacyField, { value: string }>[];
  return {
    ...rest,
    steps: {
      value: LEGACY_STEPS.flatMap((kind, index) => {
        const text = written[index]!.value;
        return text.trim() === '' ? [] : [{ kind, text }];
      }),
      // A human stands behind the steps only if behind every one of them.
      author: written.every((field) => field.author === 'human')
        ? 'human'
        : 'agent',
    },
  };
}

/** Every scenario under `scenarios` change sets, at any depth, upgraded. */
function upgradeScenarios(node: unknown): unknown {
  if (Array.isArray(node)) return node.map(upgradeScenarios);
  if (!isRecord(node)) return node;
  return Object.fromEntries(
    Object.entries(node).map(([key, value]) => {
      const upgraded = upgradeScenarios(value);
      if (key !== 'scenarios' || !isRecord(upgraded)) return [key, upgraded];
      return [
        key,
        Object.fromEntries(
          Object.entries(upgraded).map(([part, items]) => [
            part,
            part !== 'removed' && Array.isArray(items)
              ? items.map(upgradeScenario)
              : items,
          ]),
        ),
      ];
    }),
  );
}

/** A design document as read from and written to `.noesis/`: old scenarios read, new ones written. */
export const StoredDesignDocument = z.codec(z.unknown(), DesignDocument, {
  decode: (stored) =>
    upgradeScenarios(stored) as z.input<typeof DesignDocument>,
  encode: (document) => document,
});
