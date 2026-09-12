import { z } from 'zod';

/*
 * Addressing one place in a design document.
 *
 * The model is normalised and related by id, so an address is an id — nothing
 * more. An `element` ref names what it points at and says nothing about where
 * that thing currently sits, which is what lets it survive the element being
 * renamed, reordered inside its list, or moved to another parent.
 *
 * The exception is a place that holds no element of its own: the goal text,
 * `output.summary`, or a list addressed as the insertion point it is. Those
 * are `slot` refs — an owner id plus field names — and they are the only refs
 * a schema rename can invalidate.
 */

export const ElementRefSchema = z
  .discriminatedUnion('kind', [
    z.object({
      kind: z.literal('element').describe('Points at an element by its id.'),
      id: z
        .string()
        .describe(
          'The id of any element in the document, at any depth: a use case, a rule, a Gherkin step, a building-block property, the document itself.',
        ),
    }),
    z.object({
      kind: z
        .literal('slot')
        .describe(
          'Points at a field on an element that is not an element itself.',
        ),
      ownerId: z
        .string()
        .describe('The id of the element that owns the field.'),
      path: z
        .array(z.string())
        .min(1)
        .describe(
          'Field names from the owner down to the slot, e.g. ["output", "summary"].',
        ),
    }),
  ])
  .describe('The address of one place in a design document.');
export type ElementRef = z.infer<typeof ElementRefSchema>;
