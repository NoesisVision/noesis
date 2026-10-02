import { Code } from '#/shared/design-system/code.tsx';
import { QualifiedName } from '#/shared/ui/qualified-name.tsx';
import type { BuildingBlockRefInput } from '#backend/app/system-model/system-model.ts';
import {
  type DesignDocFieldInput,
  valueOf,
} from '../../../../design-doc-field.ts';
import type { ElementRef } from '../../element-ref.ts';
import { Field } from '../../field.tsx';
import { refAddressOf } from '../../ref-address.ts';
import { DetailSection } from './detail-section.tsx';

interface PropertySignatureSectionProps {
  element: ElementRef;
  name: string;
  type: DesignDocFieldInput<BuildingBlockRefInput>;
  optional: DesignDocFieldInput<boolean>;
}

/**
 * A property read as it would be declared: its name, a `?` when it may be
 * absent, and its type by its last segment, the address in full on hover.
 */
export function PropertySignatureSection({
  name,
  type,
  optional,
}: PropertySignatureSectionProps) {
  return (
    <DetailSection>
      <Code block>
        {name}
        {valueOf(optional) ? '?' : ''}:{' '}
        <Field
          field={type}
          format={refAddressOf}
          render={(address) => <QualifiedName name={address} />}
        />
        ;
      </Code>
    </DetailSection>
  );
}
