import { Accordion as MantineComponent } from '@mantine/core';
import { wrapComponent } from './wrap-component';

/** `Accordion.Item`, `.Control` and `.Panel` ride along: `wrapComponent` copies Mantine's statics. */
export const Accordion = wrapComponent(MantineComponent, 'Accordion');
