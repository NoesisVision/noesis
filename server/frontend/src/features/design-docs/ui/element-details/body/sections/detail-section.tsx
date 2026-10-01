import { IconAi, IconUser } from '@tabler/icons-react';
import { clsx } from 'clsx';
import type { ComponentProps, PropsWithChildren, ReactNode } from 'react';
import { Box } from '#/shared/design-system/box.tsx';
import { Group } from '#/shared/design-system/group.tsx';
import { Stack } from '#/shared/design-system/stack.tsx';
import { Text } from '#/shared/design-system/text.tsx';
import { ThemeIcon } from '#/shared/design-system/theme-icon.tsx';
import { Tooltip } from '#/shared/design-system/tooltip.tsx';
import { VisuallyHidden } from '#/shared/design-system/visually-hidden.tsx';
import {
  type DesignDocFieldInput,
  isHumanAuthored as humanAuthored,
} from '../../../../design-doc-field.ts';
import classes from './detail-section.module.css';

interface DetailSectionProps
  extends PropsWithChildren, ComponentProps<typeof Stack> {
  title?: string;
  /** Decorative, before the title: the title already says what it shows. */
  icon?: ReactNode;
  field?: DesignDocFieldInput<unknown>;
}

export function DetailSection({
  title,
  icon,
  children,
  className,
  field,
  ...props
}: DetailSectionProps) {
  const isHumanAuthored = field === undefined ? null : humanAuthored(field);
  // The tooltip only shows on hover; the hidden text is what a screen reader
  // hears in place of the icon.
  const author = isHumanAuthored ? 'by a human' : 'by an agent';
  return (
    <Stack
      gap="xs"
      px="md"
      className={clsx(classes.root, className)}
      {...props}
    >
      {!!title && (
        <Group gap="sm" align="center">
          {icon}
          <Text className={classes.title} fw="bold" size="xs" tt="uppercase">
            {title}
          </Text>
          {isHumanAuthored !== null && (
            <>
              <ThemeIcon size="xs" variant="default" aria-hidden="true">
                <Tooltip label={author}>
                  {isHumanAuthored ? (
                    <IconUser size={14} stroke={2} />
                  ) : (
                    <IconAi size={18} stroke={2} />
                  )}
                </Tooltip>
              </ThemeIcon>
              <VisuallyHidden>{author}</VisuallyHidden>
            </>
          )}
        </Group>
      )}
      <Box>{children}</Box>
    </Stack>
  );
}
