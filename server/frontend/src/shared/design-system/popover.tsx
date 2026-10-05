import { Popover as MantinePopover } from '@mantine/core';
import { wrapComponent } from './wrap-component';

export const Popover = Object.assign(wrapComponent(MantinePopover, 'Popover'), {
  Target: wrapComponent(MantinePopover.Target, 'Popover.Target'),
  Dropdown: wrapComponent(MantinePopover.Dropdown, 'Popover.Dropdown'),
});
