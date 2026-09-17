import { Card as MantineComponent } from '@mantine/core';
import { wrapComponent } from './wrap-component';

export const Card = wrapComponent(MantineComponent, 'Card');
