import type { z } from 'zod';
import { DesignDoc } from './design-doc';

/** What callers get back: plain data, so every adapter can send it as is. */
export const DesignDocSummary = DesignDoc.pick({
  id: true,
  name: true,
  implemented: true,
});
export type DesignDocSummary = z.infer<typeof DesignDocSummary>;

export function summarize({
  id,
  name,
  implemented,
}: DesignDoc): DesignDocSummary {
  return { id, name, implemented };
}
