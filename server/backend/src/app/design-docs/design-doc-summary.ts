import type { z } from 'zod';
import { DesignDocument } from './design-doc';

/** What callers get back: plain data, so every adapter can send it as is. */
export const DesignDocSummarySchema = DesignDocument.pick({
  id: true,
  name: true,
  implemented: true,
});
export type DesignDocSummary = z.infer<typeof DesignDocSummarySchema>;

export function summarize({
  id,
  name,
  implemented,
}: DesignDocument): DesignDocSummary {
  return { id, name, implemented };
}
