import type { ComponentType, ReactNode } from 'react';
import { Box } from '#/shared/design-system/box.tsx';
import { Group } from '#/shared/design-system/group.tsx';
import { Text } from '#/shared/design-system/text.tsx';
import { ThemeIcon } from '#/shared/design-system/theme-icon.tsx';
import { Title } from '#/shared/design-system/title.tsx';

/** What the app draws an icon with; a tabler icon satisfies it. */
export type IconComponent = ComponentType<{ size?: number; stroke?: number }>;

/**
 * The colour a kind of page is marked with, wherever it is shown — its tab in
 * the bar, the rule over the page, its heading's tile and eyebrow: an
 * overview grey, a document teal, a design document violet, the system model
 * the brand's blue.
 */
export type PageTone = 'gray' | 'teal' | 'violet' | 'brand';

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
  /** The colour of the kind of page, for its tile and eyebrow. */
  tone?: PageTone;
  /** The kind of page, in small capitals over the title. */
  eyebrow?: ReactNode;
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
  tone,
  eyebrow,
}: IconHeadingProps) {
  // The page's own heading is the largest thing on it; a heading inside the
  // page carries the same icon a size down.
  const isPageHeading = headingLevel === 1;
  return (
    <Group gap="sm" wrap="nowrap">
      {/* Decorative: the title beside it already names the page. */}
      <ThemeIcon
        variant="light"
        color={tone}
        size={isPageHeading ? 'lg' : 'md'}
        radius="md"
        aria-hidden
      >
        <Icon size={isPageHeading ? 22 : 20} stroke={1.6} />
      </ThemeIcon>
      <Box>
        {!!eyebrow && (
          // Grey has no strong shade of its own: the overview's reads as text.
          <Text
            c={tone === 'gray' ? undefined : tone}
            fz={11}
            fw={700}
            lh={1.4}
            lts="0.08em"
            tt="uppercase"
          >
            {eyebrow}
          </Text>
        )}
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
