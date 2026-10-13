import { clsx } from 'clsx';
import type { ComponentProps, PropsWithChildren, ReactNode } from 'react';
import { Box } from '#/shared/design-system/box.tsx';
import { Divider } from '#/shared/design-system/divider.tsx';
import { Group } from '#/shared/design-system/group.tsx';
import { Stack } from '#/shared/design-system/stack.tsx';
import { type DesignDocFieldInput } from '../../../../design-doc-field.ts';
import { WrittenBy } from '../../human-mark.tsx';
import classes from './detail-section.module.css';

interface DetailSectionProps
  extends PropsWithChildren, Omit<ComponentProps<typeof Stack>, 'title'> {
  /** The section's name, and what follows it on its line: a count, say. */
  title?: ReactNode;
  /** Decorative, before the title: the title already says what it shows. */
  icon?: ReactNode;
  field?: DesignDocFieldInput<unknown>;
  /** Read last and quieter, under a rule: what is said about the element rather than what it is. */
  muted?: boolean;
}

export function DetailSection({
  title,
  icon,
  children,
  className,
  field,
  muted,
  ...props
}: DetailSectionProps) {
  return (
    <Stack
      component="section"
      gap={10}
      className={clsx(classes.root, muted && classes.muted, className)}
      {...props}
    >
      {/* A rule, not a border: the divider is the design system's. */}
      {muted && <Divider mb="xs" />}
      {!!title && (
        <Group gap="xs" wrap="nowrap" className={classes.title}>
          {icon && (
            <Box component="span" className={classes.icon} aria-hidden="true">
              {icon}
            </Box>
          )}
          {/* What it holds a human wrote: the title is marked as the text is. */}
          <WrittenBy fields={[field]}>{title}</WrittenBy>
        </Group>
      )}
      <Box>{children}</Box>
    </Stack>
  );
}
