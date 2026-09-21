import { Anchor as MantineAnchor } from '@mantine/core';

export type { AnchorProps } from '@mantine/core';

import { wrapComponent } from './wrap-component';

export const Anchor = wrapComponent(MantineAnchor, 'Anchor');
