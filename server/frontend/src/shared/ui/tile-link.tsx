import { createLink, type LinkComponent } from '@tanstack/react-router';
import { clsx } from 'clsx';
import type { AnchorHTMLAttributes, ReactNode } from 'react';
import { Box } from '#/shared/design-system/box.tsx';
import { Text } from '#/shared/design-system/text.tsx';
import { ThemeIcon } from '#/shared/design-system/theme-icon.tsx';
import type { IconComponent } from '#/shared/ui/icon-heading.tsx';
import classes from './tile-link.module.css';

// `title` is an anchor attribute of its own — the tooltip — and here it is
// the tile's, so the HTML one goes.
interface TileLinkProps extends Omit<
  AnchorHTMLAttributes<HTMLAnchorElement>,
  'title'
> {
  /** What the tile leads to: a document's title, a design document's name. */
  title: ReactNode;
  /** The icon of its kind, on a tile of its own. */
  icon: IconComponent;
  /** The colour of its kind, for the icon's tile; none for a white one. */
  tone?: string;
  /** What it is, under its title: "Document", "Design doc". */
  kind: ReactNode;
  /** One more quiet line under that: a date, a stage. */
  meta?: ReactNode;
  /** The meta line set in italic, as a stage is. */
  metaItalic?: boolean;
  /** A dot in the kind's colour at the tile's end, beside the title. */
  dot?: boolean;
  /** What the title is in the outline of the page it sits on. */
  headingLevel?: 2 | 3 | 4;
}

function TileLinkBase({
  title,
  icon: Icon,
  tone,
  kind,
  meta,
  metaItalic = false,
  dot = false,
  headingLevel = 3,
  className,
  ...props
}: TileLinkProps) {
  return (
    <Box
      component="a"
      className={clsx(classes.tile, className)}
      data-tone={tone}
      {...props}
    >
      {/* Decorative: the title beside it already says what it is. */}
      <ThemeIcon
        size="xl"
        radius="md"
        variant={tone === undefined ? 'default' : 'light'}
        color={tone}
        aria-hidden
      >
        <Icon size={20} stroke={1.6} />
      </ThemeIcon>
      <Box className={classes.text}>
        <Text component={`h${headingLevel}`} fw={600} className={classes.title}>
          {title}
        </Text>
        <Text size="sm" c="var(--noesis-secondary-text)">
          {kind}
        </Text>
        {meta !== undefined && (
          <Text
            size="sm"
            c="dimmed"
            mt={6}
            fs={metaItalic ? 'italic' : undefined}
          >
            {meta}
          </Text>
        )}
      </Box>
      {dot && (
        <Box
          component="span"
          className={classes.dot}
          bg={`${tone}.6`}
          aria-hidden
        />
      )}
    </Box>
  );
}

const RoutedTileLink = createLink(TileLinkBase);

/**
 * A soft tile that is the link, as a change's overview lists what it holds.
 * `to` and `params` are the router's own, checked against the route tree.
 */
export const TileLink: LinkComponent<typeof TileLinkBase> = (props) => (
  <RoutedTileLink preload="intent" {...props} />
);
