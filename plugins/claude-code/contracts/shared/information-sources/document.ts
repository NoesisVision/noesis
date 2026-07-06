// GENERATED from @repo/mcp-contracts — do not edit; run `bun run generate`.
import { z } from 'zod';
import { InformationCategory } from './information-category.js';

export const DocumentFragmentRefSchema = z.object({
  type: z.literal('document_fragment_ref'),
  document_id: z.string(),
  fragment_index: z.int(),
  source_sha: z
    .string()
    .optional()
    .describe(
      'SHA-256 of the referenced source content at ref-creation time. Used to detect stale references when the source content changes.',
    ),
});
export type DocumentFragmentRef = z.infer<typeof DocumentFragmentRefSchema>;

export const DocumentFragmentKindSchema = z.enum([
  'paragraph',
  'list',
  'list_item',
  'code_block',
  'table',
  'blockquote',
  'structural',
]);
export type DocumentFragmentKind = z.infer<typeof DocumentFragmentKindSchema>;

export const DocumentFragmentSchema = z.object({
  index: z.int(),
  section_path: z.array(z.string()),
  kind: DocumentFragmentKindSchema,
  text: z.string(),
  categories: z.array(InformationCategory).default(() => []),
});
export type DocumentFragment = z.infer<typeof DocumentFragmentSchema>;

export const DocumentSectionSchema: z.ZodType<DocumentSection> = z.lazy(() =>
  z.object({
    level: z.int(),
    title: z.string(),
    path: z.array(z.string()),
    fragment_indices: z.array(z.int()),
    children: z.array(DocumentSectionSchema),
  }),
);
export interface DocumentSection {
  level: number;
  title: string;
  path: string[];
  fragment_indices: number[];
  children: DocumentSection[];
}

export const DocumentSchema = z.object({
  document_id: z.string(),
  title: z.string(),
  date: z.string(),
  fragments: z.array(DocumentFragmentSchema),
  section_tree: z.array(DocumentSectionSchema),
});
export type Document = z.infer<typeof DocumentSchema>;
