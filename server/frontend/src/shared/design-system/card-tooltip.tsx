import { Tooltip, type TooltipProps } from './tooltip';
import { wrapComponent } from './wrap-component';

// Blue in the light; in the dark a grey a few steps off the card, as the
// dark's other edges are, so nothing about the card reads as blue there.
const EDGE =
  '1px dashed light-dark(var(--mantine-color-brand-4), var(--mantine-color-dark-3))';

/**
 * A tooltip drawn as a card, for what an element is rather than what a
 * control does: a card raised off the page in either scheme — white in the
 * light, the dark's card grey in the dark — with a dashed edge and the page's
 * own text, so the two read as one another's reflection.
 */
export const CardTooltip = wrapComponent<typeof Tooltip, TooltipProps>(
  Tooltip,
  'CardTooltip',
  {
    // `color` sets the background.
    color:
      'light-dark(var(--mantine-color-white), var(--mantine-color-dark-6))',
    styles: {
      tooltip: {
        boxShadow: 'var(--mantine-shadow-lg)',
        border: EDGE,
        color:
          'light-dark(var(--mantine-color-black), var(--mantine-color-dark-0))',
      },
      arrow: {
        border: EDGE,
      },
    },
  },
);
