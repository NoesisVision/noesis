import { z } from 'zod';

export const DesignDocFieldStatus = z
  .enum(['setByAgent', 'acceptedByHuman', 'setByHuman'])
  .describe(
    "Who stands behind a field's value: 'setByAgent' when an agent wrote it and no human has looked at it, 'acceptedByHuman' when a human accepted a value an agent wrote, 'setByHuman' when a human wrote it.",
  );
export type DesignDocFieldStatus = z.infer<typeof DesignDocFieldStatus>;

const designDocFieldSchema = <Value extends z.ZodType>(value: Value) =>
  z.object({
    value,
    status: DesignDocFieldStatus.default('setByAgent'),
  });

export const DesignDocField = Object.assign(designDocFieldSchema, {
  of: <T>(
    value: T,
    status: DesignDocFieldStatus = 'setByAgent',
  ): DesignDocField<T> => ({ value, status }),
  is: (candidate: unknown): candidate is DesignDocField<unknown> =>
    typeof candidate === 'object' &&
    candidate !== null &&
    'value' in candidate &&
    'status' in candidate &&
    DesignDocFieldStatus.safeParse(candidate.status).success,
});
export interface DesignDocField<T> extends z.infer<
  ReturnType<typeof designDocFieldSchema<z.ZodType<T>>>
> {}
