import { type TooltipProps, Tooltip as MantineComponent } from '@mantine/core';
import { wrapComponent } from './wrap-component';

export const Tooltip = wrapComponent<typeof MantineComponent, TooltipProps>(
  MantineComponent,
  'Tooltip',
  {
    arrowSize: 6,
    withArrow: true,
    radius: 8,
    // The brand's light-variant colour: a deep blue in the light scheme and a
    // pale one in the dark, so the text flips with it to stay readable.
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
