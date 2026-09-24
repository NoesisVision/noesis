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
  /**
   * Where the title sits in the page's outline: `1` is the page's own heading,
   * deeper is a heading inside it — the title of a card in a list.
   */
  headingLevel?: 1 | 2 | 3 | 4;
}

/**
 * A title under the icon of whatever kind of thing it names: the heading of a
 * page, or of a card that leads to one. One component for all of them, so an
 * item is headed the same way wherever it is named.
 */
export function IconHeading({
  title,
  icon: Icon,
  description,
  headingLevel = 1,
}: IconHeadingProps) {
  // The page's own heading is the largest thing on it; a heading inside the
  // page carries the same icon a size down.
  const isPageHeading = headingLevel === 1;
  return (
    <Group gap="sm" wrap="nowrap">
      {/* Decorative: the title beside it already names the page. */}
      <ThemeIcon
        variant="light"
        size={isPageHeading ? 'lg' : 'md'}
        radius="md"
        aria-hidden
      >
        <Icon size={isPageHeading ? 22 : 20} stroke={1.6} />
      </ThemeIcon>
      <Box>
        {/* `size` holds the type scale steady while the level moves. */}
        <Title order={headingLevel} size={`h${headingLevel + 1}`} mb={0}>
          {title}
        </Title>
        {!!description && (
          <Text size="sm" c="dimmed">
            {description}
          </Text>
        )}
      </Box>
    </Group>
  );
}
