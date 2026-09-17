import { MantineProvider as Provider } from '@mantine/core';
import { wrapComponent } from './wrap-component';

export const MantineProvider = wrapComponent(Provider, 'MantineProvider');
