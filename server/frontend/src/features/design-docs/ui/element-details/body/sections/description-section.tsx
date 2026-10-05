import type { ReactNode } from 'react';
import { Text } from '#/shared/design-system/text.tsx';
import { MarkdownEditor } from '#/shared/ui/markdown-editor.tsx';
import {
  type DesignDocFieldInput,
  isUnchanged,
  valueOf,
} from '../../../../design-doc-field.ts';
import type { ElementRef } from '../../element-ref.ts';
import { DetailSection } from './detail-section.tsx';
import { EditElementButton } from './edit-element-button.tsx';

interface DescriptionSectionProps {
  element: ElementRef;
  field: DesignDocFieldInput<string>;
  /** A module, building block or behaviour is defined; anything else described, and a rule reasoned for. */
  title?: 'Description' | 'Definition' | 'Rationale';
  slots?: {
    top?: ReactNode;
    bottom?: ReactNode;
  };
}

/**
 * A description or definition is markdown, and the diagrams in it are drawn: it is the one
 * field long enough to be written rather than named. The editor reads its
 * markdown once, on mount, so another element is another editor — which is
 * why `ElementDetail` keys the sections by the element's own path.
 *
 * `headingLevel` puts the document's own `#` at `h3`: the page is headed by
 * the design, the panel by the element, and the prose nests under both.
 */
export function DescriptionSection({
  element,
  field,
  title = 'Description',
  slots = {},
}: DescriptionSectionProps) {
  const value = valueOf(field);

  /*
   * Left alone, the description is whatever the model already says; written
   * but blank, there is nothing to read.
   */
  return (
    <DetailSection
      title={title}
      field={field}
      muted
      action={<EditElementButton element={element} field={title} />}
    >
      {slots?.top}
      {isUnchanged(field) || value === null ? (
        <Text c="dimmed" size="sm">
          unchanged
        </Text>
      ) : value.trim() === '' ? (
        <Text c="dimmed" size="sm">
          Not specified.
        </Text>
      ) : (
        <MarkdownEditor markdown={value} headingLevel={3} readOnly noMargin />
      )}
      {slots?.bottom}
    </DetailSection>
  );
}
