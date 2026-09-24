import { SegmentedControl as MantineSegmentedControl } from '@mantine/core';
import { wrapComponent } from './wrap-component';

export const SegmentedControl = wrapComponent(
  MantineSegmentedControl,
  'SegmentedControl',
);
