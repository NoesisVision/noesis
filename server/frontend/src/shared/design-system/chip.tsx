import { Chip as MantineChip } from '@mantine/core';
import { wrapComponent } from './wrap-component';

export const Chip = Object.assign(wrapComponent(MantineChip, 'Chip'), {
  Group: wrapComponent(MantineChip.Group, 'Chip.Group'),
});
