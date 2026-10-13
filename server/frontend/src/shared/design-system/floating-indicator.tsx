import { FloatingIndicator as MantineFloatingIndicator } from '@mantine/core';
import { wrapComponent } from './wrap-component';

export const FloatingIndicator = wrapComponent(
  MantineFloatingIndicator,
  'FloatingIndicator',
);
