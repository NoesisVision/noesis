import { VisuallyHidden as MantineVisuallyHidden } from '@mantine/core';
import { wrapComponent } from './wrap-component';

export const VisuallyHidden = wrapComponent(
  MantineVisuallyHidden,
  'VisuallyHidden',
);
