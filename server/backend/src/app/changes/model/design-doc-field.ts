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

type ChangedDesignDocField<T> = z.infer<
  ReturnType<typeof changedDesignDocFieldSchema<z.ZodType<T>>>
>;

const unchangedDesignDocFieldSchema = z.strictObject({
  changed: z.literal(false),
});

type UnchangedDesignDocField = z.infer<typeof unchangedDesignDocFieldSchema>;

const anyDesignDocField = z.discriminatedUnion('changed', [
  z.strictObject({
    changed: z.literal(true),
    value: z.unknown(),
    author: DesignDocFieldAuthor,
  }),
  unchangedDesignDocFieldSchema,
]);

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
  /** A parsed field, defaults spelled out: what a walk over a document meets. */
  is: (candidate: unknown): candidate is DesignDocField<unknown> =>
    anyDesignDocField.safeParse(candidate).success,
});
export type DesignDocField<T> =
  | ChangedDesignDocField<T>
  | UnchangedDesignDocField;
