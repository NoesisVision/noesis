import type { z } from 'zod';
import { SourceDocument } from './source-document';

/** What callers get back: plain data, so every adapter can send it as is. */
export const SourceDocumentSummary = SourceDocument.pick({
  id: true,
  title: true,
  date: true,
});
export type SourceDocumentSummary = z.infer<typeof SourceDocumentSummary>;

export function summarize({
  id,
  title,
  date,
}: SourceDocument): SourceDocumentSummary {
  return { id, title, date };
}
