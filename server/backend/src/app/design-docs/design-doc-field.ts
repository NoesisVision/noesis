import { z } from 'zod';

export const DesignDocFieldAuthor = z
  .enum(['agent', 'human'])
  .describe(
    "Who stands behind a field: 'agent' when an agent wrote it, 'human' when a human wrote or accepted it.",
  );
export type DesignDocFieldAuthor = z.infer<typeof DesignDocFieldAuthor>;

const changedDesignDocFieldSchema = <Value extends z.ZodType>(value: Value) =>
  z.object({
    changed: z.literal(true).default(true),
    value,
    author: DesignDocFieldAuthor.default('agent'),
  });

export interface ChangedDesignDocField<T> extends z.infer<
  ReturnType<typeof changedDesignDocFieldSchema<z.ZodType<T>>>
> {}

const unchangedDesignDocFieldSchema = z.strictObject({
  changed: z.literal(false),
  author: DesignDocFieldAuthor.default('agent'),
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
  is: (candidate: unknown): candidate is DesignDocField<unknown> =>
    typeof candidate === 'object' &&
    candidate !== null &&
    'changed' in candidate &&
    typeof candidate.changed === 'boolean' &&
    'author' in candidate &&
    DesignDocFieldAuthor.safeParse(candidate.author).success,
});
export type DesignDocField<T> =
  | ChangedDesignDocField<T>
  | UnchangedDesignDocField;
