import { z } from 'zod';

export const DesignDocFieldAuthor = z
  .enum(['agent', 'human'])
  .describe(
    "Who stands behind a field: 'agent' when an agent wrote it, 'human' when a human wrote or accepted it.",
  );
export type DesignDocFieldAuthor = z.infer<typeof DesignDocFieldAuthor>;

const changedDesignDocFieldSchema = <Value extends z.ZodType>(value: Value) =>
  z.strictObject({
    changed: z.literal(true).default(true),
    value,
    author: DesignDocFieldAuthor.default('agent'),
  });

export type ChangedDesignDocField<T> = z.infer<
  ReturnType<typeof changedDesignDocFieldSchema<z.ZodType<T>>>
>;

const unchangedDesignDocFieldSchema = z.strictObject({
  changed: z.literal(false),
});

export type UnchangedDesignDocField = z.infer<
  typeof unchangedDesignDocFieldSchema
>;

const designDocFieldSchema = <Value extends z.ZodType>(value: Value) =>
  z
    .discriminatedUnion('changed', [
      changedDesignDocFieldSchema(value),
      unchangedDesignDocFieldSchema,
    ])
    .prefault({ changed: false });

export const DesignDocField = Object.assign(designDocFieldSchema, {
  of: <T>(
    value: T,
    author: DesignDocFieldAuthor = 'agent',
  ): ChangedDesignDocField<T> => ({ changed: true, value, author }),
  is: (candidate: unknown): candidate is DesignDocField<unknown> => {
    if (typeof candidate !== 'object' || candidate === null) return false;
    if (!('changed' in candidate)) return false;
    if (candidate.changed === false) return Object.keys(candidate).length === 1;
    return (
      candidate.changed === true &&
      'value' in candidate &&
      'author' in candidate &&
      DesignDocFieldAuthor.safeParse(candidate.author).success
    );
  },
});
export type DesignDocField<T> =
  | ChangedDesignDocField<T>
  | UnchangedDesignDocField;
