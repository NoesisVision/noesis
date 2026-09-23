import { createLink, type LinkComponent } from '@tanstack/react-router';
import { clsx } from 'clsx';
import type { AnchorHTMLAttributes, ReactNode } from 'react';
import { Card } from '#/shared/design-system/card.tsx';
import { Stack } from '#/shared/design-system/stack.tsx';
import { Text } from '#/shared/design-system/text.tsx';
import { Title } from '#/shared/design-system/title.tsx';
import classes from './card-link.module.css';

// `title` and `content` are anchor attributes of their own — the tooltip and
// the metadata value — and here they are the card's, so the HTML ones go.
interface CardLinkProps extends Omit<
  AnchorHTMLAttributes<HTMLAnchorElement>,
  'title' | 'content'
> {
  /** What the card is: a document's title, a design document's name. */
  title: ReactNode;
  /** A line under the title, for what the item is rather than what it says. */
  description?: ReactNode;
  /** Whatever else belongs on the card, under the two lines above. */
  content?: ReactNode;
  /**
   * What the card's title is, in the outline of the page it sits on: an `h2`
   * directly under the view's heading, an `h3` inside a section of its own.
   */
  headingLevel?: 2 | 3 | 4;
}

function CardLinkBase({
  title,
  description,
  content,
  headingLevel = 2,
  className,
  ...props
}: CardLinkProps) {
  return (
    <Card
      component="a"
      withBorder
      padding="lg"
      className={clsx(classes.card, className)}
      {...props}
    >
      <Stack gap={4}>
        {/* `size` holds the type scale steady while the level moves. */}
        <Title order={headingLevel} size={`h${headingLevel + 1}`} mb={0}>
          {title}
        </Title>
        {!!description && (
          <Text size="sm" c="dimmed">
            {description}
          </Text>
        )}
        {!!content && <Text size="sm">{content}</Text>}
      </Stack>
    </Card>
  );
}

const RoutedCardLink = createLink(CardLinkBase);

/**
 * A card that is the link. `to` and `params` are the router's own, checked
 * against the route tree, so a card cannot point at a route that is not there.
 */
export const CardLink: LinkComponent<typeof CardLinkBase> = (props) => (
  <RoutedCardLink preload="intent" {...props} />
);
