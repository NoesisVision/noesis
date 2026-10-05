import { Tooltip, type TooltipProps } from './tooltip';
import { wrapComponent } from './wrap-component';

/**
 * A tooltip drawn as a card, for what an element is rather than what a
 * control does: a white card in the light scheme and the brand's darkest
 * blue in the dark, with a dashed brand edge and text set against each.
 */
export const CardTooltip = wrapComponent<typeof Tooltip, TooltipProps>(
  Tooltip,
  'CardTooltip',
  {
    // `color` sets the background.
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
  },
);
