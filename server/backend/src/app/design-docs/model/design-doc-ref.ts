import { z } from 'zod';

/*
 * An `element` ref survives its target being renamed, reordered or moved to
 * another parent. A `slot` ref also addresses a list as an insertion point,
 * and is the only kind a schema rename can invalidate.
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
