import { Code } from '#/shared/design-system/code.tsx';
import { QualifiedName } from '#/shared/ui/qualified-name.tsx';
import type { Cardinality } from '#backend/app/system-model/system-model.ts';
import {
  type DesignDocFieldInput,
  valueOf,
} from '../../../../design-doc-field.ts';
import { cardinalitySuffixOf } from '../../../../relations.ts';
import type { ElementRef } from '../../element-ref.ts';
import { ElementTooltip } from '../../element-tooltip.tsx';
import { Field } from '../../field.tsx';
import { refAddressOf } from '../../ref-address.ts';
import { DetailSection } from './detail-section.tsx';

interface PropertySignatureSectionProps {
  element: ElementRef;
  name: string;
  type: DesignDocFieldInput<string>;
  cardinality: DesignDocFieldInput<Cardinality>;
}

/**
 * A property read as it would be declared: its name, its type by its last
 * segment, the address in full on hover, and how many it holds after the
 * type when not exactly one.
 */
export function PropertySignatureSection({
  name,
  type,
  cardinality,
}: PropertySignatureSectionProps) {
  return (
    <DetailSection>
      <Code block>
        {name}:{' '}
        <Field
          field={type}
          format={refAddressOf}
          render={(address) => (
            <ElementTooltip name={address}>
              <span>
                <QualifiedName name={address} />
              </span>
            </ElementTooltip>
          )}
        />
        {cardinalitySuffixOf(valueOf(cardinality))};
      </Code>
    </DetailSection>
  );
}
