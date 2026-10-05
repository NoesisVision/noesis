import { type TooltipProps, Tooltip as MantineComponent } from '@mantine/core';
import { wrapComponent } from './wrap-component';

export type { TooltipProps } from '@mantine/core';

/** A plain tooltip: a short hint in Mantine's own colours, for a control that says what it does. */
export const Tooltip = wrapComponent<typeof MantineComponent, TooltipProps>(
  MantineComponent,
  'Tooltip',
  {
    arrowSize: 6,
    withArrow: true,
    radius: 8,
    transitionProps: {
      transition: 'pop',
      duration: 100,
    },
  },
);
