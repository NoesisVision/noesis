import { Card as MantineComponent, type CardProps } from '@mantine/core';
import { wrapComponent } from './wrap-component';

export const Card = wrapComponent<typeof MantineComponent, CardProps>(
  MantineComponent,
  'Card',
  // Rounded as the app's other surfaces are: panes, side cards, dropdowns.
  { radius: 18, shadow: 'sm', withBorder: true },
);
