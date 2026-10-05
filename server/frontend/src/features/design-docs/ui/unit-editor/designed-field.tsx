import { IconArrowBackUp, IconSparkles, IconUser } from '@tabler/icons-react';
import type { ReactNode } from 'react';
import { ActionIcon } from '#/shared/design-system/action-icon.tsx';
import { Group } from '#/shared/design-system/group.tsx';
import { Stack } from '#/shared/design-system/stack.tsx';
import { Text } from '#/shared/design-system/text.tsx';
import { Tooltip } from '#/shared/design-system/tooltip.tsx';
import { UnstyledButton } from '#/shared/design-system/unstyled-button.tsx';
import type { DesignDocFieldAuthor } from '#backend/app/design-docs/design-doc-field.ts';
import classes from './designed-field.module.css';

/**
 * One field of a unit, as the design writes it or leaves it. In a unit the
 * design revises, a field it leaves alone is a box to click to write it, and
 * one it writes can go back to what the model says. A new unit writes every
 * field, so it has neither.
 */
export function DesignedField({
  label,
  written,
  revisable,
  author,
  error,
  onWrite,
  onReset,
  children,
}: {
  label: string;
  written: boolean;
  /** The unit is in the model already, so a field may be left as the model has it. */
  revisable: boolean;
  author: DesignDocFieldAuthor | null;
  error?: ReactNode;
  onWrite: () => void;
  onReset: () => void;
  children: ReactNode;
}) {
  const unchanged = revisable && !written;
  return (
    <Stack gap={4}>
      <Group justify="space-between" wrap="nowrap" mih={28}>
        <Text component="span" size="sm" fw={500}>
          {label}
        </Text>
        {revisable && written && (
          <Group gap="xs" wrap="nowrap">
            {author !== null && <AuthorMark author={author} />}
            <Tooltip label="Keep what the model says" openDelay={300}>
              <ActionIcon
                variant="subtle"
                size="md"
                aria-label={`Keep the ${label.toLowerCase()} the model has`}
                onClick={onReset}
              >
                <IconArrowBackUp size={20} aria-hidden />
              </ActionIcon>
            </Tooltip>
          </Group>
        )}
      </Group>
      {unchanged ? (
        <UnstyledButton
          className={classes.unchanged}
          aria-label={`${label}: unchanged — click to write`}
          onClick={onWrite}
        >
          unchanged — click to write
        </UnstyledButton>
      ) : (
        children
      )}
      {error && (
        <Text size="xs" c="red">
          {error}
        </Text>
      )}
    </Stack>
  );
}

/** Who stands behind the value, in words beside the icon. */
function AuthorMark({ author }: { author: DesignDocFieldAuthor }) {
  return (
    <Text span fz="xs" fw={500} c="dimmed" className={classes.author}>
      {author === 'human' ? (
        <IconUser size={14} aria-hidden />
      ) : (
        <IconSparkles size={14} aria-hidden />
      )}
      {author === 'human' ? 'Written by a human' : 'AI-generated'}
    </Text>
  );
}
