import { type TooltipProps, Tooltip as MantineComponent } from '@mantine/core';
import { wrapComponent } from './wrap-component';

export const Tooltip = wrapComponent<typeof MantineComponent, TooltipProps>(
  MantineComponent,
  'Tooltip',
  {
    arrowSize: 6,
    withArrow: true,
    radius: 8,
    // `color` sets the background: a white card in the light scheme and the
    // brand's darkest blue in the dark, the text set against each below.
    color:
      'light-dark(var(--mantine-color-white), var(--mantine-color-brand-9))',
    styles: {
      tooltip: {
        boxShadow: 'var(--mantine-shadow-lg)',
        border: '1px dashed var(--mantine-color-brand-4)',
        color:
          'light-dark(var(--mantine-color-black), var(--mantine-color-brand-0))',
      },
      arrow: {
        border: '1px dashed var(--mantine-color-brand-4)',
      },
    },
    transitionProps: {
      transition: 'pop',
      duration: 100,
    },
  },
);
