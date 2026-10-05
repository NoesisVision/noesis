import { MermaidDiagram } from '#/shared/ui/mermaid-diagram.tsx';
import {
  type DesignDocFieldInput,
  valueOf,
} from '../../../../design-doc-field.ts';
import type { ElementRef } from '../../element-ref.ts';
import { DetailSection } from './detail-section.tsx';
import { EditElementButton } from './edit-element-button.tsx';

interface DiagramSectionProps {
  element: ElementRef;
  field: DesignDocFieldInput<string>;
}

/** The element's diagram, drawn: the design writes its Mermaid source alone. */
export function DiagramSection({ element, field }: DiagramSectionProps) {
  const source = valueOf(field);
  if (source === null) return null;

  return (
    <DetailSection
      title="Diagram"
      field={field}
      action={<EditElementButton element={element} field="Diagram" />}
    >
      <MermaidDiagram chart={source} />
    </DetailSection>
  );
}

/** Shown only when the design draws one: the model never has a diagram. */
DiagramSection.shows = ({ field }: DiagramSectionProps) =>
  valueOf(field) !== null;
