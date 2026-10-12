import { Menu as MantineMenu } from '@mantine/core';
import { wrapComponent } from './wrap-component';

export const Menu = Object.assign(wrapComponent(MantineMenu, 'Menu'), {
  Target: wrapComponent(MantineMenu.Target, 'Menu.Target'),
  Dropdown: wrapComponent(MantineMenu.Dropdown, 'Menu.Dropdown'),
  Item: wrapComponent(MantineMenu.Item, 'Menu.Item'),
  Label: wrapComponent(MantineMenu.Label, 'Menu.Label'),
  Divider: wrapComponent(MantineMenu.Divider, 'Menu.Divider'),
});
