import { DetailSection } from '#/features/design-docs/ui/element-details/detail-section.tsx';
import { Text } from '#/shared/design-system/text.tsx';
import { MarkdownEditor } from '#/shared/ui/markdown-editor.tsx';
import { type DesignDocFieldInput, valueOf } from '../../design-doc-field.ts';

/**
 * A description is markdown, and the diagrams in it are drawn: it is the one
 * field long enough to be written rather than named. The editor reads its
 * markdown once, on mount, so another element is another editor — which is
 * why `ElementDetail` keys the body by the element's own path.
 *
 * `headingLevel` puts the document's own `#` at `h3`: the page is headed by
 * the design, the panel by the element, and the prose nests under both.
 */
export function Description({ field }: { field: DesignDocFieldInput<string> }) {
  const value = valueOf(field);

  return (
    <DetailSection title="Description" field={field}>
      {value === null || value.trim() === '' ? (
        <Text c="dimmed">Not specified.</Text>
      ) : (
        <MarkdownEditor markdown={value} headingLevel={3} readOnly noMargin />
      )}
    </DetailSection>
  );
}
