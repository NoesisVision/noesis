import { createPolymorphicComponent } from '@mantine/core';
import {
  type ComponentRef,
  type ElementType,
  type ForwardRefRenderFunction,
  forwardRef,
  type PropsWithoutRef,
} from 'react';

export function createPolymorphicWrapper<
  DefaultComponent extends ElementType,
  Props,
>(
  name: string,
  render: ForwardRefRenderFunction<
    ComponentRef<DefaultComponent>,
    PropsWithoutRef<Props>
  >,
) {
  const component = forwardRef<ComponentRef<DefaultComponent>, Props>(render);
  component.displayName = `DesignSystem.${name}`;
  return createPolymorphicComponent<DefaultComponent, Props>(component);
}
