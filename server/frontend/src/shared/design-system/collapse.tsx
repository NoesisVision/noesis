import { Collapse as MantineComponent } from '@mantine/core';
import { wrapComponent } from './wrap-component';

/** Content that slides open and shut under what toggles it. */
export const Collapse = wrapComponent(MantineComponent, 'Collapse');
