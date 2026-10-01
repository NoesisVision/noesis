import { type TooltipProps, Tooltip as MantineComponent } from '@mantine/core';
import { wrapComponent } from './wrap-component';

export const Tooltip = wrapComponent<typeof MantineComponent, TooltipProps>(
  MantineComponent,
  'Tooltip',
  {
    arrowSize: 4,
    withArrow: true,
    transitionProps: {
      transition: 'pop',
      duration: 100,
    },
  },
);
