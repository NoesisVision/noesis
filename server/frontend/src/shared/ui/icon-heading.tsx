import type { ComponentType, ReactNode } from 'react';
import { Box } from '#/shared/design-system/box.tsx';
import { Group } from '#/shared/design-system/group.tsx';
import { Text } from '#/shared/design-system/text.tsx';
import { ThemeIcon } from '#/shared/design-system/theme-icon.tsx';
import { Title } from '#/shared/design-system/title.tsx';

/** What the app draws an icon with; a tabler icon satisfies it. */
export type IconComponent = ComponentType<{ size?: number; stroke?: number }>;

interface IconHeadingProps {
  /** The view or the item: a nav label, a document's title, a design's name. */
  title: ReactNode;
  /** The icon of the kind, as the sidebar and the overview draw it. */
  icon: IconComponent;
  /** What this is, for a view that needs a line to say so. */
  description?: ReactNode;
}

/**
 * The heading of a page, under the icon of whatever kind of thing it shows.
 * One component for both, so a view and the details beneath it are headed the
 * same way.
 */
export function IconHeading({
  title,
  icon: Icon,
  description,
}: IconHeadingProps) {
  return (
    <Group gap="sm" wrap="nowrap">
      {/* Decorative: the title beside it already names the page. */}
      <ThemeIcon variant="light" size="lg" radius="md" aria-hidden>
        <Icon size={22} stroke={1.6} />
      </ThemeIcon>
      <Box>
        <Title order={1} size="h2" mb={0}>
          {title}
        </Title>
        {!!description && (
          <Text size="sm" c="gray">
            {description}
          </Text>
        )}
      </Box>
    </Group>
  );
}
