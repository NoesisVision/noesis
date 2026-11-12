import { Code } from '#/shared/design-system/code.tsx';
import { QualifiedName } from '#/shared/ui/qualified-name.tsx';
import type { Cardinality } from '#backend/app/system-model/system-model.ts';
import {
  type DesignDocFieldInput,
  valueOf,
} from '../../../../design-doc-field.ts';
import { CardinalityMark, isMarked } from '../../cardinality-mark.tsx';
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
 * segment, the address in full on hover, and — when not exactly one — the
 * gray mark for how many it holds before the type, as a signature marks it.
 */
export function PropertySignatureSection({
  name,
  type,
  cardinality,
}: PropertySignatureSectionProps) {
  const holds = valueOf(cardinality);
  return (
    <DetailSection>
      <Code block>
        {name}: {isMarked(holds) && <CardinalityMark cardinality={holds} />}
        <Field
          field={type}
          format={refAddressOf}
          render={(address) => (
            <ElementTooltip
              name={address}
              cardinality={isMarked(holds) ? holds : undefined}
            >
              <span>
                <QualifiedName name={address} />
              </span>
            </ElementTooltip>
          )}
        />
        ;
      </Code>
    </DetailSection>
  );
}
