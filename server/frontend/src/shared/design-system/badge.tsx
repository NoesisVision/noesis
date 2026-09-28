import { Badge as MantineBadge } from '@mantine/core';
import { wrapComponent } from './wrap-component';
export { type BadgeProps } from '@mantine/core';

// oxlint-disable-next-line react/only-export-components
export const Badge = wrapComponent(MantineBadge, 'Badge');
