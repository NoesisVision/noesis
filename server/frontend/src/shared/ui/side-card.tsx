import type { ReactNode } from 'react';
import { Box } from '#/shared/design-system/box.tsx';
import { Group } from '#/shared/design-system/group.tsx';
import { Stack } from '#/shared/design-system/stack.tsx';
import { Text } from '#/shared/design-system/text.tsx';
import { UnstyledButton } from '#/shared/design-system/unstyled-button.tsx';
import classes from './side-card.module.css';

/**
 * A small card beside a read text, saying something about it: what its
 * links mean, what it links to, what it is made of. Its title is a heading
 * a level under the page's, with how many it holds after it.
 */
export function SideCard({
  title,
  count,
  children,
}: {
  title: string;
  /** How many it lists; none for a card that lists nothing. */
  count?: number;
  children: ReactNode;
}) {
  return (
    <Box className={classes.card}>
      <Group gap={8} wrap="nowrap">
        <Text component="h2" className={classes.title}>
          {title}
        </Text>
        {count !== undefined && (
          <Box component="span" className={classes.count} aria-hidden>
            {count}
          </Box>
        )}
      </Group>
      {children}
    </Box>
  );
}

/** What a side card lists, one under another. */
export function SideRows({ children }: { children: ReactNode }) {
  return <Stack gap={2}>{children}</Stack>;
}

interface SideRowProps {
  icon: ReactNode;
  label: string;
  /** Takes the reader to it on the page… */
  onClick?: () => void;
  /** …or away from it, in a tab of its own. */
  href?: string;
  /** Where the reader is, among the rows: marked, and said to be. */
  current?: boolean;
  /** For the row's own colour, read by `--side-row-icon`. */
  'data-view'?: string;
}

/** One thing a side card lists, which opens it. */
export function SideRow({
  icon,
  label,
  onClick,
  href,
  current = false,
  ...rest
}: SideRowProps) {
  const content = (
    <>
      {icon}
      <Text component="span" size="13px" truncate>
        {label}
      </Text>
    </>
  );
  return href === undefined ? (
    // Its whole name on hover, where the row cuts it short.
    <UnstyledButton
      className={classes.row}
      title={label}
      aria-current={current ? 'location' : undefined}
      onClick={onClick}
      {...rest}
    >
      {content}
    </UnstyledButton>
  ) : (
    <UnstyledButton
      component="a"
      href={href}
      target="_blank"
      rel="noreferrer"
      className={classes.row}
      title={href}
      {...rest}
    >
      {content}
    </UnstyledButton>
  );
}
