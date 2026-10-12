import { Radio as MantineRadio } from '@mantine/core';
import { wrapComponent } from './wrap-component';

export const Radio = Object.assign(wrapComponent(MantineRadio, 'Radio'), {
  Group: wrapComponent(MantineRadio.Group, 'Radio.Group'),
});
