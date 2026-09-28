import { Code } from '#/shared/design-system/code.tsx';
import { Stack } from '#/shared/design-system/stack.tsx';
import type { DesignedPropertyInput } from '#backend/app/design-docs/design-doc.ts';
import { valueOf } from '../../design-doc-field.ts';
import { Field } from './field.tsx';
import { refAddressOf } from './ref-address.ts';

export function PropertyBody({
  property,
}: {
  property: DesignedPropertyInput;
}) {
  return (
    <Stack gap="sm">
      <Code block>
        // {valueOf(property.description)}
        <br />
        <br />
        {property.name}
        {valueOf(property.optional) ? '?' : ''}:{' '}
        <Field field={property.type} format={refAddressOf} fallback="?" />;
      </Code>
    </Stack>
  );
}
