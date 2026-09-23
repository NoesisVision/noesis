import type { ReactNode } from 'react';
import { Box } from '#/shared/design-system/box.tsx';
import { Center } from '#/shared/design-system/center.tsx';
import { Stack } from '#/shared/design-system/stack.tsx';
import { Text } from '#/shared/design-system/text.tsx';
import { Title } from '#/shared/design-system/title.tsx';
import classes from './status-panel.module.css';

interface StatusPanelProps {
  /** The HTTP status, or the word standing in for one. An empty state has none. */
  code?: ReactNode;
  /** What happened, in the words the reader needs. */
  title: ReactNode;
  /** A line under it, for what to do about it. */
  description?: ReactNode;
  /** Retry, Back — whatever the caller offers under the text. */
  action?: ReactNode;
  /**
   * Says the panel when it appears, for what the reader did not ask to see.
   * The `Alert` this replaced carried `role="alert"` and a failure has to keep
   * being announced; an empty state is an answer, and does not.
   */
  announce?: boolean;
  /**
   * `1` when the panel is the page, `2` when a view the shell has already
   * headed renders it — the page may only ever hold one `h1`.
   */
  headingLevel?: 1 | 2;
}

/**
 * The one box the app says anything in the centre of a view with: a failure,
 * a missing thing, a view with nothing in it yet.
 */
export function StatusPanel({
  code,
  title,
  description,
  action,
  announce = false,
  headingLevel = 1,
}: StatusPanelProps) {
  return (
    <Center mih="60vh">
      <Stack
        align="center"
        gap="sm"
        maw={420}
        ta="center"
        role={announce ? 'alert' : undefined}
      >
        {/* Not a heading: the status is a label on the page, not part of its outline. */}
        {code !== undefined && <Text className={classes.code}>{code}</Text>}
        {/* `size` holds the type scale steady while the level moves. */}
        <Title order={headingLevel} size={`h${headingLevel + 2}`} mb={0}>
          {title}
        </Title>
        {!!description && <Text c="dimmed">{description}</Text>}
        {!!action && <Box mt="xs">{action}</Box>}
      </Stack>
    </Center>
  );
}
