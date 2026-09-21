import { UnstyledButton as MantineUnstyledButton } from '@mantine/core';
import { wrapComponent } from './wrap-component';

export const UnstyledButton = wrapComponent(
  MantineUnstyledButton,
  'UnstyledButton',
);
