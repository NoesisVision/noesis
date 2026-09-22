import type { IconProps } from '@tabler/icons-react';
import type { ComponentType, ReactNode } from 'react';
import { Group } from '#/shared/design-system/group.tsx';
import { ThemeIcon } from '#/shared/design-system/theme-icon.tsx';
import { Title } from '#/shared/design-system/title.tsx';

interface DetailHeaderProps {
  /** The item itself: a document's title, a design document's name. */
  title: ReactNode;
  /** The icon of the kind, as the sidebar and the overview draw it. */
  icon: ComponentType<IconProps>;
}

/**
 * Names the one item a detail view is showing. The view above it says what
 * kind of thing this is, so this says which one, and the icon carries the
 * kind down from there.
 */
export function DetailHeader({ title, icon: Icon }: DetailHeaderProps) {
  return (
    <Group gap="sm" wrap="nowrap">
      <ThemeIcon variant="light" size="lg" radius="md">
        <Icon size={22} stroke={1.6} />
      </ThemeIcon>
      <Title order={2} mb={0}>
        {title}
      </Title>
    </Group>
  );
}
