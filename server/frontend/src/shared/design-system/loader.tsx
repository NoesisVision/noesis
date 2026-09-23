import { Loader as MantineLoader } from '@mantine/core';
import { wrapComponent } from './wrap-component';

export const Loader = wrapComponent(MantineLoader, 'Loader');
