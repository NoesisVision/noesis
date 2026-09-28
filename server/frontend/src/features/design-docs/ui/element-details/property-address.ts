import { valueOf } from '#/features/design-docs/design-doc-field.ts';
import { refAddressOf } from '#/features/design-docs/ui/element-details/ref-address.ts';
import type { OutlineChange } from '#/shared/ui/model-tree/model-outline.ts';
import type { DesignedPropertyInput } from '#backend/app/design-docs/design-doc.ts';

export const changedPropertyAddressOf = <T extends OutlineChange>(
  change: T,
): ((ref: DesignedPropertyInput | string) => { change: T; name: string }) => {
  return (property) => ({
    change,
    name:
      typeof property === 'string'
        ? property
        : property.type?.changed
          ? `${property.name}${valueOf(property.optional) ? '?' : ''}: ${refAddressOf(valueOf(property.type)!)}`
          : '',
  });
};
