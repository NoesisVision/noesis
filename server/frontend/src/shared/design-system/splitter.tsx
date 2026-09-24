import { Splitter as MantineSplitter } from '@mantine/core';
import { wrapComponent } from './wrap-component';

/** `Splitter.Pane` rides along: `wrapComponent` copies Mantine's statics. */
export const Splitter = wrapComponent(MantineSplitter, 'Splitter');
