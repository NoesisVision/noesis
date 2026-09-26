import type { z } from 'zod';
import { SourceDocument } from './source-document';

/** What callers get back: plain data, so every adapter can send it as is. */
export const SourceDocumentSummary = SourceDocument.pick({
  id: true,
  title: true,
  date: true,
});
export type SourceDocumentSummary = z.infer<typeof SourceDocumentSummary>;

/** Parsing strips every key the summary does not pick. */
export function summarize(document: SourceDocument): SourceDocumentSummary {
  return SourceDocumentSummary.parse(document);
}
