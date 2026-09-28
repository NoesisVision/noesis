import type { z } from 'zod';
import { type Document, DocumentSchema } from './document';

/** What callers get back: plain data, so every adapter can send it as is. */
export const DocumentSummarySchema = DocumentSchema.pick({
  id: true,
  title: true,
  date: true,
});
export type DocumentSummary = z.infer<typeof DocumentSummarySchema>;

export function summarize({ id, title, date }: Document): DocumentSummary {
  return { id, title, date };
}
