import { Card as MantineComponent, type CardProps } from '@mantine/core';
import { wrapComponent } from './wrap-component';

export const Card = wrapComponent<typeof MantineComponent, CardProps>(
  MantineComponent,
  'Card',
  { radius: 'md', shadow: 'sm', withBorder: true },
);
