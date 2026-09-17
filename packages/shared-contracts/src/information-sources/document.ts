import { z } from 'zod';
import { InformationCategory } from './information-category.js';

/*
 * An imported document: its content split into fragments the wiki can point
 * at, plus the section tree that says where each fragment sits. One file per
 * document under `.noesis/graph/changes/<change>/documents/`; never rewritten after
 * import.
 */

export const DocumentFragmentRefSchema = z
  .object({
    type: z
      .literal('document_fragment_ref')
      .describe('Marks this reference as pointing into a document.'),
    document_id: z.string().describe('The id of the document file.'),
    fragment_index: z.int().describe('The `index` of the fragment.'),
    source_sha: z
      .string()
      .optional()
      .describe(
        'SHA-256 of the referenced source content at ref-creation time. Used to detect stale references when the source content changes.',
      ),
  })
  .describe('A pointer to one fragment of one document.');
export type DocumentFragmentRef = z.infer<typeof DocumentFragmentRefSchema>;

export const DocumentFragmentKindSchema = z
  .enum([
    'paragraph',
    'list',
    'list_item',
    'code_block',
    'table',
    'blockquote',
    'structural',
  ])
  .describe(
    'The block the fragment came from. `structural` is a heading or other scaffolding kept for position, not content.',
  );
export type DocumentFragmentKind = z.infer<typeof DocumentFragmentKindSchema>;

export const DocumentFragmentSchema = z
  .object({
    index: z
      .int()
      .describe('Position of the fragment in the document, from 0.'),
    section_path: z
      .array(z.string())
      .describe(
        'Heading titles from the top of the document down to the section holding this fragment.',
      ),
    kind: DocumentFragmentKindSchema,
    text: z.string().describe('The fragment text, verbatim.'),
    categories: z
      .array(InformationCategory)
      .default([])
      .describe('What the fragment does in the document; usually one label.'),
  })
  .describe('One block of the document: a paragraph, a list item, a table.');
export type DocumentFragment = z.infer<typeof DocumentFragmentSchema>;

export interface DocumentSection {
  level: number;
  title: string;
  path: string[];
  fragment_indices: number[];
  children: DocumentSection[];
}
export const DocumentSectionSchema: z.ZodType<DocumentSection> = z
  .lazy(() =>
    z.object({
      level: z.int().describe('Heading level, 1 for the top.'),
      title: z.string().describe('The heading text.'),
      path: z
        .array(z.string())
        .describe(
          'Heading titles from the top down to and including this one.',
        ),
      fragment_indices: z
        .array(z.int())
        .describe(
          'The `index` of every fragment directly in this section, not in its children.',
        ),
      children: z
        .array(DocumentSectionSchema)
        .describe('Subsections, in document order.'),
    }),
  )
  .describe('One heading and what sits under it.');

export const DocumentSchema = z
  .object({
    document_id: z
      .string()
      .describe(
        'The document id: a content hash of the source, so re-importing the same document yields the same id.',
      ),
    title: z.string().describe('The document title.'),
    date: z
      .string()
      .describe(
        'When the document was written or last revised, ISO 8601 date.',
      ),
    fragments: z
      .array(DocumentFragmentSchema)
      .describe('Every fragment of the document, in reading order.'),
    section_tree: z
      .array(DocumentSectionSchema)
      .describe('The top-level sections; each holds its subsections.'),
  })
  .describe(
    'An imported document: the data.json of graph/changes/<change>/documents/<id>/.',
  );
export type Document = z.infer<typeof DocumentSchema>;
