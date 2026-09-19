import {
  Button as MantineButton,
  type ButtonProps as MantineButtonProps,
} from '@mantine/core';
import { createPolymorphicWrapper } from './create-polymorphic-wrapper';
import { wrapComponent } from './wrap-component';

export interface ButtonProps extends MantineButtonProps {
  busy?: boolean;
}

export const Button = Object.assign(
  createPolymorphicWrapper<'button', ButtonProps>(
    'Button',
    ({ busy = false, loading, disabled, ...props }, ref) => (
      <MantineButton
        {...props}
        ref={ref}
        loading={busy || loading}
        disabled={busy || disabled}
      />
    ),
  ),
  {
    extend: MantineButton.extend,
    classes: MantineButton.classes,
    Group: wrapComponent(MantineButton.Group, 'Button.Group'),
    GroupSection: wrapComponent(
      MantineButton.GroupSection,
      'Button.GroupSection',
    ),
  },
);
